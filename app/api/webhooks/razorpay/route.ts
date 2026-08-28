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

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!verifyWebhookSignature(raw, signature)) {
    // Deliberately terse: an attacker probing this endpoint learns nothing
    // about why it failed.
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  let body: RazorpayWebhookBody;
  try {
    body = JSON.parse(raw) as RazorpayWebhookBody;
  } catch {
    return NextResponse.json({ error: "malformed body" }, { status: 400 });
  }

  const event = body.event ?? "unknown";
  // Razorpay sends an id header on every delivery; fall back to a synthetic
  // key so a missing header can't collapse unrelated events onto one row.
  const eventId =
    request.headers.get("x-razorpay-event-id") ??
    `${event}:${body.payload?.payment?.entity?.id ?? body.payload?.refund?.entity?.id ?? raw.length}`;

  // ── Layer 1: has this exact delivery been seen? ──
  try {
    await prisma.razorpayEvent.create({
      data: { eventId, event, payload: body as object, signatureVerified: true },
    });
  } catch {
    // Unique violation — a retry of something already recorded. 200 so
    // Razorpay stops. Anything else here would earn 24 hours of retries for
    // an event we have already handled.
    return NextResponse.json({ ok: true, duplicate: true });
  }

  if (!HANDLED.has(event)) {
    await markProcessed(eventId, null);
    return NextResponse.json({ ok: true, ignored: event });
  }

  try {
    await handle(event, body);
    await markProcessed(eventId, null);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await markProcessed(eventId, message);

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
      if (!payment?.order_id || !payment.id) return;
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
      if (!result.ok && result.code !== "UNKNOWN_ORDER") {
        throw new Error(result.error);
      }
      return;
    }

    case "payment.failed": {
      if (!payment?.order_id) return;
      // The hold is left alone on purpose — it still has minutes to run and
      // the customer may simply retry with another card. release_expired_holds
      // reclaims the seat if they don't.
      await prisma.payment.updateMany({
        where: { razorpayOrderId: payment.order_id, status: { notIn: ["CAPTURED", "REFUNDED"] } },
        data: {
          status: "FAILED",
          failureReason: payment.error_description ?? payment.error_reason ?? "Payment failed",
        },
      });
      return;
    }

    case "refund.processed":
    case "refund.failed": {
      if (!refund?.id) return;
      await applyRefundEvent({
        razorpayRefundId: refund.id,
        razorpayPaymentId: refund.payment_id,
        amountPaise: refund.amount,
        processed: event === "refund.processed",
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
