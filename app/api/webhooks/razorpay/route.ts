import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature } from "@/lib/payments/signature";
import { settlePayment } from "@/lib/payments/settle";
import { applyRefundEvent } from "@/lib/payments/refunds";

/**
 * Razorpay's server-to-server notifications. This is the authoritative path.
 *
 * Three properties matter here, all of them dictated by how Razorpay behaves:
 *
 *  1. RAW BODY. The signature is an HMAC over the exact bytes sent. Reading
 *     request.json() and re-serialising produces different bytes and the
 *     digest never matches — so the body is read as text and parsed after.
 *
 *  2. IDEMPOTENT. Delivery is retried with exponential backoff for 24 hours.
 *     The unique index on razorpay_events.event_id turns a retry into a
 *     no-op, and a duplicate returns 200 rather than an error so Razorpay
 *     stops retrying something that already succeeded.
 *
 *  3. ORDER-INDEPENDENT. Events can arrive out of order — payment.captured
 *     may land before order.paid. Every handler is written as "make this true"
 *     rather than "apply this change", so the final state is the same either
 *     way.
 *
 * Note this route is excluded from middleware (see middleware.ts): it carries
 * no session, and an auth round trip per delivery would be latency Razorpay
 * counts against us.
 */

// Signature verification needs the raw body and node crypto.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Events we act on. Anything else is stored and acknowledged, not processed. */
const HANDLED = new Set([
  "payment.captured",
  "payment.failed",
  "order.paid",
  "refund.processed",
  "refund.failed",
]);

/**
 * One prefix, so a whole delivery can be pulled out of the platform log with
 * `grep "[razorpay-webhook]"`.
 *
 * Never the raw body and never the signature: the body carries customer
 * contact details and the signature is a secret-derived digest. Ids, the
 * event name, amounts and the outcome are enough to answer every question
 * we have actually needed to ask.
 */
const TAG = "[razorpay-webhook]";
const log = {
  info: (msg: string, data?: Record<string, unknown>) =>
    console.log(TAG, msg, data ? JSON.stringify(data) : ""),
  warn: (msg: string, data?: Record<string, unknown>) =>
    console.warn(TAG, msg, data ? JSON.stringify(data) : ""),
  error: (msg: string, data?: Record<string, unknown>) =>
    console.error(TAG, msg, data ? JSON.stringify(data) : ""),
};

/** The claimed event name, for logging only. Never trusted for a decision. */
function peekEvent(raw: string): string {
  try {
    const v = (JSON.parse(raw) as { event?: unknown }).event;
    return typeof v === "string" ? v.slice(0, 40) : "unparseable";
  } catch {
    return "unparseable";
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  const deliveryId = request.headers.get("x-razorpay-event-id");

  if (!verifyWebhookSignature(raw, signature)) {
    /**
     * The one log that had to exist.
     *
     * A rejected delivery is refused before anything is written, so until
     * now it left no trace anywhere: an empty razorpay_events table could
     * mean "Razorpay never sent it" or "Razorpay sent it and we threw it
     * away", and there was no way to tell which. Those are completely
     * different problems — a webhook URL pointing at the wrong host, versus
     * a mismatched RAZORPAY_WEBHOOK_SECRET.
     *
     * Deliberately console-only, not a database row: this runs before any
     * authentication, so persisting it would let anyone fill the table.
     */
    log.warn("REJECTED — signature did not verify", {
      hasSignatureHeader: Boolean(signature),
      deliveryId,
      claimedEvent: peekEvent(raw),
      bodyBytes: raw.length,
      // Distinguishes "secret is wrong" from "secret is missing entirely",
      // which is the quoted-env-var failure we have already hit once.
      secretConfigured: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET?.trim()),
    });
    // The RESPONSE stays terse: an attacker probing this endpoint learns
    // nothing about why it failed. The detail goes to our logs, not theirs.
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  let body: RazorpayWebhookBody;
  try {
    body = JSON.parse(raw) as RazorpayWebhookBody;
  } catch {
    log.warn("REJECTED — body is not JSON", { deliveryId, bodyBytes: raw.length });
    return NextResponse.json({ error: "malformed body" }, { status: 400 });
  }

  const event = body.event ?? "unknown";
  // Razorpay sends an id header on every delivery; fall back to a synthetic
  // key so a missing header can't collapse unrelated events onto one row.
  const eventId =
    deliveryId ??
    `${event}:${body.payload?.payment?.entity?.id ?? body.payload?.refund?.entity?.id ?? raw.length}`;

  const paymentId = body.payload?.payment?.entity?.id ?? null;
  const refundId = body.payload?.refund?.entity?.id ?? null;

  // ── Layer 1: has this exact delivery been seen? ──
  try {
    await prisma.razorpayEvent.create({
      data: { eventId, event, payload: body as object, signatureVerified: true },
    });
  } catch {
    // Unique violation — a retry of something already recorded. 200 so
    // Razorpay stops. Anything else here would earn 24 hours of retries for
    // an event we have already handled.
    log.info("duplicate — already recorded, acknowledged", { event, eventId });
    return NextResponse.json({ ok: true, duplicate: true });
  }

  log.info("accepted", { event, eventId, paymentId, refundId });

  if (!HANDLED.has(event)) {
    await markProcessed(eventId, null);
    log.info("ignored — not an event we act on", { event, eventId });
    return NextResponse.json({ ok: true, ignored: event });
  }

  try {
    await handle(event, body);
    await markProcessed(eventId, null);
    log.info("done", { event, eventId, ms: Date.now() - startedAt });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await markProcessed(eventId, message);

    // Loud, because a 500 here means Razorpay will retry for 24 hours and
    // then give up — after which the event is gone and the booking is
    // silently out of date. The event row carries the same message.
    log.error("FAILED — Razorpay will retry", {
      event, eventId, paymentId, refundId, ms: Date.now() - startedAt, error: message,
    });

    // 500 asks Razorpay to retry. That is what we want for a transient
    // failure — a database blip shouldn't lose a payment — and the event row
    // now carries the error for anyone investigating.
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}

async function handle(event: string, body: RazorpayWebhookBody) {
  const payment = body.payload?.payment?.entity;
  const refund = body.payload?.refund?.entity;

  switch (event) {
    // Both mean "the money is ours". order.paid carries the payment entity
    // too, so they converge on the same idempotent call and whichever lands
    // first wins; the second is a no-op.
    case "payment.captured":
    case "order.paid": {
      if (!payment?.order_id || !payment.id) {
        // Marked processed with no error below, so without this it reads as
        // a success that did nothing at all.
        log.warn("skipped — payment entity has no order_id/id", { event });
        return;
      }
      const result = await settlePayment({
        orderId: payment.order_id,
        paymentId: payment.id,
        amountPaise: payment.amount,
        signatureVerified: true,
        methodLabel: payment.method ?? null,
      });
      // An unknown order is not retryable — most likely a webhook from a
      // different environment sharing this secret. Swallow it rather than
      // earning 24 hours of retries.
      if (!result.ok && result.code === "UNKNOWN_ORDER") {
        // Worth a line: it is the signature of two deployments pointed at
        // one Razorpay account, and it looks identical to silence.
        log.warn("unknown order — not ours, ignoring", {
          event, orderId: payment.order_id, paymentId: payment.id,
        });
        return;
      }
      if (!result.ok) throw new Error(result.error);
      log.info("settled", {
        event,
        paymentId: payment.id,
        reference: "reference" in result ? result.reference : null,
        state: "state" in result ? result.state : null,
        amountPaise: payment.amount,
      });
      return;
    }

    case "payment.failed": {
      if (!payment?.order_id) {
        log.warn("skipped — failed payment has no order_id", { event });
        return;
      }
      // The hold is left alone on purpose — it still has minutes to run and
      // the customer may simply retry with another card. release_expired_holds
      // reclaims the seat if they don't.
      const marked = await prisma.payment.updateMany({
        where: { razorpayOrderId: payment.order_id, status: { notIn: ["CAPTURED", "REFUNDED"] } },
        data: {
          status: "FAILED",
          failureReason: payment.error_description ?? payment.error_reason ?? "Payment failed",
        },
      });
      log.info("payment marked failed", {
        orderId: payment.order_id,
        rows: marked.count,
        reason: payment.error_reason ?? null,
      });
      return;
    }

    case "refund.processed":
    case "refund.failed": {
      if (!refund?.id) {
        log.warn("skipped — refund entity has no id", { event });
        return;
      }
      await applyRefundEvent({
        razorpayRefundId: refund.id,
        razorpayPaymentId: refund.payment_id,
        amountPaise: refund.amount,
        processed: event === "refund.processed",
      });
      log.info("refund applied", {
        event, refundId: refund.id, paymentId: refund.payment_id, amountPaise: refund.amount,
      });
      return;
    }
  }
}

function markProcessed(eventId: string, error: string | null) {
  return prisma.razorpayEvent.update({
    where: { eventId },
    data: { processedAt: new Date(), processingError: error },
  });
}

type RazorpayWebhookBody = {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        amount: number;
        method?: string | null;
        error_reason?: string | null;
        error_description?: string | null;
      };
    };
    refund?: {
      entity?: { id?: string; payment_id: string; amount: number };
    };
  };
};
