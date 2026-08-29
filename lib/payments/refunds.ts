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
        select: { amountPaise: true },
      },
    },
  });

  if (!booking) return { ok: false, error: "That booking no longer exists." };

  const alreadyRefunded = booking.refunds.reduce((n, r) => n + r.amountPaise, 0);
  const refundable = booking.amountPaidPaise - alreadyRefunded;

  if (refundable <= 0) {
    return { ok: false, error: "Everything paid on this booking has already been refunded." };
  }
  if (amountPaise > refundable) {
    return {
      ok: false,
      error: `Only ₹${(refundable / 100).toLocaleString("en-IN")} is left to refund on this booking.`,
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
