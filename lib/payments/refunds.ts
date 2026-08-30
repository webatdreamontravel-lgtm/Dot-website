import "server-only";

import { prisma } from "@/lib/prisma";
import { razorpay } from "@/lib/payments/client";
import { notifyRefundOutcome } from "@/lib/booking/notify";

export type RefundResult =
  | { ok: true; refundId: string; amountPaise: number }
  | { ok: false; error: string };

/**
 * Sends money back.
 *
 * Two halves, deliberately separated. `requestRefund` records the intent and
 * asks Razorpay; `applyRefundEvent` reacts to what Razorpay eventually says.
 * Razorpay confirms refunds asynchronously — a refund can sit pending for
 * days over a weekend — so treating the API call's return as "done" would
 * show travellers money back that had not yet moved.
 *
 * refunds.refunded_paise on the booking is only ever written from the
 * PROCESSED transition, so the figure on screen means "left our account",
 * not "we asked".
 *
 * Neither half touches booking.status. Money moving and a booking ending are
 * separate decisions, and only the admin path knows how to move seats to
 * match — see the note in applyRefundEvent.
 */
export async function requestRefund(input: {
  bookingId: string;
  amountPaise: number;
  reason?: string;
  notes?: string;
  initiatedByProfileId?: string;
}): Promise<RefundResult> {
  const { bookingId, amountPaise } = input;

  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    return { ok: false, error: "Enter a refund amount greater than zero." };
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true, reference: true, amountPaidPaise: true,
      payments: {
        where: { status: "CAPTURED", razorpayPaymentId: { not: null } },
        orderBy: { capturedAt: "desc" },
        select: { id: true, razorpayPaymentId: true, amountPaise: true },
      },
      refunds: {
        where: { status: { not: "FAILED" } },
        select: { amountPaise: true, method: true },
      },
    },
  });

  if (!booking) return { ok: false, error: "That booking no longer exists." };

  /**
   * The ceiling is what RAZORPAY holds, not what the booking was paid.
   *
   * A booking settled with ₹1,100 by UPI and ₹1,000 of travel credit has
   * amountPaidPaise of ₹2,100 — but Razorpay only ever received ₹1,100, and
   * cannot send back money it never took. Measuring against the booking
   * total let the screen offer ₹2,100, and the request then failed deep
   * inside Razorpay's API with a PENDING row already written.
   *
   * Credit paid is returned as credit, by carrying the booking forward. It
   * is not a refund and does not belong in this arithmetic.
   */
  const gatewayPaidPaise = Math.min(
    booking.payments.reduce((n, p) => n + p.amountPaise, 0),
    // Never more than the booking was actually credited. On bookings taken
    // before the fee-bearer change, payments.amount_paise is the gross the
    // card was charged and the difference is Razorpay's fee — money we were
    // never given and must not send back.
    booking.amountPaidPaise,
  );

  /**
   * Only GATEWAY refunds reduce what the gateway can still send.
   *
   * Cash handed over takes nothing out of Razorpay, so counting it here
   * reported nothing refundable on a booking where Razorpay was still
   * holding money. Everything non-failed still counts toward `held` below —
   * the two limits are genuinely different quantities.
   */
  const gatewayRefunded = booking.refunds
    .filter((r) => r.method === "RAZORPAY")
    .reduce((n, r) => n + r.amountPaise, 0);
  const allRefunded = booking.refunds.reduce((n, r) => n + r.amountPaise, 0);
  const heldPaise = booking.amountPaidPaise - allRefunded;

  const refundable = Math.min(gatewayPaidPaise - gatewayRefunded, heldPaise);

  if (gatewayPaidPaise === 0) {
    return {
      ok: false,
      error:
        "Nothing on this booking was paid through Razorpay, so there is nothing to send back. " +
        "Return it the way it came in, or carry the booking forward as travel credit.",
    };
  }
  if (refundable <= 0) {
    return { ok: false, error: "Everything paid through Razorpay has already been refunded." };
  }
  if (amountPaise > refundable) {
    return {
      ok: false,
      error:
        `Only ₹${(refundable / 100).toLocaleString("en-IN")} was paid through Razorpay and ` +
        `is still refundable.`,
    };
  }

  // Refund against the most recent captured payment large enough to carry it.
  // Splitting one refund across several payments is possible but rare enough
  // that the team is better served doing it as two refunds they can see.
  const source = booking.payments.find((p) => p.amountPaise >= amountPaise) ?? booking.payments[0];
  if (!source?.razorpayPaymentId) {
    return {
      ok: false,
      error: "No online payment on this booking to refund. Return it the way it came in and record it here.",
    };
  }

  // Recorded BEFORE the API call. If the process dies mid-request, a PENDING
  // row with no Razorpay id is visible and recoverable; a successful refund
  // with no local record is not.
  const refund = await prisma.refund.create({
    data: {
      bookingId: booking.id,
      paymentId: source.id,
      amountPaise,
      status: "PENDING",
      reason: input.reason || null,
      notes: input.notes || null,
      initiatedByProfileId: input.initiatedByProfileId || null,
    },
    select: { id: true },
  });

  try {
    const created = await razorpay().payments.refund(source.razorpayPaymentId, {
      amount: amountPaise,
      speed: "normal",
      notes: { bookingId: booking.id, reference: booking.reference, refundRowId: refund.id },
    });

    await prisma.refund.update({
      where: { id: refund.id },
      data: { razorpayRefundId: created.id },
    });

    return { ok: true, refundId: refund.id, amountPaise };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.refund.update({
      where: { id: refund.id },
      data: { status: "FAILED", failureReason: message.slice(0, 500) },
    });
    return { ok: false, error: `Razorpay refused the refund: ${message}` };
  }
}

/**
 * Applies what Razorpay says happened to a refund. Called from the webhook.
 *
 * Idempotent by the same means as settlement: the row is claimed with a
 * status-guarded update, so a replayed refund.processed can't add the amount
 * to the booking twice.
 */
export async function applyRefundEvent(input: {
  razorpayRefundId: string;
  razorpayPaymentId: string;
  amountPaise: number;
  processed: boolean;
}): Promise<void> {
  /**
   * What the transaction decided, so the emails can be sent after it commits.
   *
   * Nothing is sent from inside: a mail provider hanging would hold the
   * booking row lock for the length of an HTTP timeout, and a rollback after
   * a send would leave someone told about a refund the database no longer
   * believes in.
   */
  let outcome: { bookingId: string; refundedTotalPaise: number } | null = null;

  await prisma.$transaction(async (tx) => {
    // Match the row we created; fall back to adopting a refund raised
    // directly in the Razorpay dashboard, which has no local row yet.
    let refund = await tx.refund.findFirst({
      where: {
        OR: [
          { razorpayRefundId: input.razorpayRefundId },
          {
            razorpayRefundId: null,
            status: "PENDING",
            amountPaise: input.amountPaise,
            payment: { razorpayPaymentId: input.razorpayPaymentId },
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, bookingId: true, amountPaise: true },
    });

    if (!refund) {
      const payment = await tx.payment.findUnique({
        where: { razorpayPaymentId: input.razorpayPaymentId },
        select: { id: true, bookingId: true },
      });
      if (!payment) return; // Not a payment of ours.

      refund = await tx.refund.create({
        data: {
          bookingId: payment.bookingId,
          paymentId: payment.id,
          amountPaise: input.amountPaise,
          status: "PENDING",
          razorpayRefundId: input.razorpayRefundId,
          notes: "Raised directly in the Razorpay dashboard.",
        },
        select: { id: true, status: true, bookingId: true, amountPaise: true },
      });
    }

    const target = input.processed ? "PROCESSED" : "FAILED";

    // The claim. Only a transition out of PENDING counts.
    const claimed = await tx.refund.updateMany({
      where: { id: refund.id, status: "PENDING" },
      data: {
        status: target,
        razorpayRefundId: input.razorpayRefundId,
        processedAt: input.processed ? new Date() : null,
        failureReason: input.processed ? null : "Razorpay reported the refund failed",
      },
    });
    if (claimed.count === 0) return;

    if (!input.processed) {
      // A failure nobody would otherwise see. The money is still with us and
      // the customer was never told it had gone, so this is the team's
      // problem to pick up — see notifyRefundOutcome.
      outcome = { bookingId: refund.bookingId, refundedTotalPaise: -1 };
      return;
    }

    // Recompute rather than increment: the sum of PROCESSED rows is the
    // definition of what was refunded, so it can't drift from its own parts.
    const agg = await tx.refund.aggregate({
      where: { bookingId: refund.bookingId, status: "PROCESSED" },
      _sum: { amountPaise: true },
    });
    const total = agg._sum.amountPaise ?? 0;

    /**
     * Only the money. The booking's status is left exactly as it was.
     *
     * This used to flip a fully-refunded booking to REFUNDED, which sounds
     * right and isn't. Refunding and cancelling are different acts: one
     * returns money, the other returns a SEAT. REFUNDED is not a
     * seat-occupying status, so setting it here would tell the booking it no
     * longer holds a seat while trips.seats_booked still counted one — a
     * trip that "sells out" with an empty chair in it, discovered on the
     * morning of departure.
     *
     * The admin panel already changes status properly: updateBookingStatus()
     * moves seats to match and refuses if the trip has since filled. So a
     * webhook has no business doing it as a side effect, and a person
     * deciding a booking is over is the correct author of that decision.
     */
    await tx.booking.update({
      where: { id: refund.bookingId },
      data: { refundedPaise: total },
    });

    await tx.auditLog.create({
      data: {
        action: "refund.processed",
        entity: "booking",
        entityId: refund.bookingId,
        after: { razorpayRefundId: input.razorpayRefundId, amountPaise: input.amountPaise, refundedTotalPaise: total },
      },
    });

    outcome = { bookingId: refund.bookingId, refundedTotalPaise: total };
  });

  // Only when the claim actually succeeded — a replayed webhook returns
  // early and must not send a second copy of either mail.
  if (outcome) {
    await notifyRefundOutcome({
      bookingId: (outcome as { bookingId: string }).bookingId,
      amountPaise: input.amountPaise,
      refundedTotalPaise: (outcome as { refundedTotalPaise: number }).refundedTotalPaise,
      razorpayRefundId: input.razorpayRefundId,
      processed: input.processed,
    });
  }
}
