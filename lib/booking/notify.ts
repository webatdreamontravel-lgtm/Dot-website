import "server-only";

import { prisma } from "@/lib/prisma";
import {
  bookingCancelledEmail,
  bookingConfirmedEmail,
  creditIssuedEmail,
  paymentReceivedEmail,
  refundFailedAdminEmail,
  refundProcessedEmail,
  sendEmail,
} from "@/emails";

/**
 * Telling the customer what the team just did to their booking.
 *
 * The admin panel changes real things — money recorded, a booking confirmed,
 * a seat given back — and until now none of it reached the person it
 * happened to. Someone paid ₹3,000 in cash at a stall and got no receipt;
 * someone's booking was cancelled and the first they'd have known is turning
 * up at the pickup point.
 *
 * ── Three rules everything here follows ──
 *
 * 1. NEVER THROWS. A mail provider being down must not fail an action that
 *    has already committed. The admin gets their success either way, and the
 *    failure is visible in email_log rather than as a red banner about
 *    something that did in fact work.
 *
 * 2. ALWAYS OUTSIDE THE TRANSACTION. Holding a database transaction open
 *    across an HTTP call to Resend is how one slow third party becomes a
 *    lock-contention outage.
 *
 * 3. DEDUPED PER EVENT, NOT PER BOOKING. A double-clicked button sends once.
 *    But a second cash payment on the same booking is genuinely a second
 *    receipt, so payment keys carry the amount and the day rather than just
 *    the booking id.
 */

/** Everything a customer-facing mail needs, from one query. */
const notifySelect = {
  id: true,
  reference: true,
  status: true,
  seats: true,
  totalPaise: true,
  amountPaidPaise: true,
  refundedPaise: true,
  cancellationReason: true,
  trip: {
    select: { title: true, slug: true, startDate: true, endDate: true, startingFrom: true },
  },
  profile: { select: { email: true, fullName: true } },
  travellers: {
    where: { cancelledAt: null },
    select: { fullName: true, email: true },
    orderBy: { createdAt: "asc" as const },
    take: 1,
  },
} as const;

type Notifiable = Awaited<ReturnType<typeof loadBooking>>;

async function loadBooking(bookingId: string) {
  return prisma.booking.findUnique({ where: { id: bookingId }, select: notifySelect });
}

/** The address to write to, and the name to open with. */
function recipient(booking: NonNullable<Notifiable>) {
  const to = booking.profile.email ?? booking.travellers[0]?.email ?? null;
  const name = booking.profile.fullName ?? booking.travellers[0]?.fullName ?? "there";
  return { to, name };
}

/**
 * An offline payment the team recorded — cash, UPI, a bank transfer.
 *
 * If this payment is what confirmed the booking, the customer gets the same
 * confirmation an online payer would. Anything else gets a receipt. Never
 * both: "you're in" is only true once, and a second copy weeks later reads
 * as a mistake.
 */
export async function notifyPaymentRecorded(input: {
  bookingId: string;
  amountPaise: number;
  method: string;
  externalReference: string | null;
  justConfirmed: boolean;
}) {
  try {
    const booking = await loadBooking(input.bookingId);
    if (!booking) return;
    const { to, name } = recipient(booking);
    if (!to) return;

    // The amount and the day are in the key so a second genuine payment
    // still sends, while a double-clicked button does not.
    const day = new Date().toISOString().slice(0, 10);
    const dedupeKey = `payment_recorded:${booking.id}:${input.amountPaise}:${day}`;

    const mail = input.justConfirmed
      ? bookingConfirmedEmail({
          name,
          reference: booking.reference,
          tripTitle: booking.trip.title,
          tripSlug: booking.trip.slug,
          startDate: booking.trip.startDate,
          endDate: booking.trip.endDate,
          startingFrom: booking.trip.startingFrom,
          seats: booking.seats,
          paidPaise: booking.amountPaidPaise,
          totalPaise: booking.totalPaise,
        })
      : paymentReceivedEmail({
          name,
          reference: booking.reference,
          tripTitle: booking.trip.title,
          method: input.method,
          externalReference: input.externalReference,
          amountPaise: input.amountPaise,
          paidPaise: booking.amountPaidPaise,
          totalPaise: booking.totalPaise,
        });

    await sendEmail({
      to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      template: input.justConfirmed ? "booking_confirmed" : "payment_received",
      bookingId: booking.id,
      dedupeKey,
    });
  } catch (e) {
    // Rule 1. The payment is already recorded; this is the only place the
    // failure needs to show up.
    console.error("[notify] payment recorded email failed", e);
  }
}

/**
 * A status the team changed by hand.
 *
 * Only two statuses are worth an email. CONFIRMED and CANCELLED are things
 * that happened TO the customer. PENDING_PAYMENT, REQUESTED and EXPIRED are
 * bookkeeping — "your booking is now expired" tells someone nothing they can
 * act on and invites a worried reply. REFUNDED has its own flow in
 * refundBooking(), where the amount actually returned is known.
 */
export async function notifyStatusChange(input: {
  bookingId: string;
  status: string;
  reason: string | null;
}) {
  if (input.status !== "CONFIRMED" && input.status !== "CANCELLED") return;

  try {
    const booking = await loadBooking(input.bookingId);
    if (!booking) return;
    const { to, name } = recipient(booking);
    if (!to) return;

    const mail =
      input.status === "CONFIRMED"
        ? bookingConfirmedEmail({
            name,
            reference: booking.reference,
            tripTitle: booking.trip.title,
            tripSlug: booking.trip.slug,
            startDate: booking.trip.startDate,
            endDate: booking.trip.endDate,
            startingFrom: booking.trip.startingFrom,
            seats: booking.seats,
            paidPaise: booking.amountPaidPaise,
            totalPaise: booking.totalPaise,
          })
        : bookingCancelledEmail({
            name,
            reference: booking.reference,
            tripTitle: booking.trip.title,
            startDate: booking.trip.startDate,
            seats: booking.seats,
            paidPaise: booking.amountPaidPaise,
            refundedPaise: booking.refundedPaise,
            reason: input.reason ?? booking.cancellationReason,
          });

    /**
     * Keyed on the status, not the day.
     *
     * A booking that is cancelled, reinstated and cancelled again is two
     * genuinely different pieces of news — but the second cancellation is
     * suppressed by this key. That is the right trade: an accidental
     * double-cancel is common and a deliberate re-cancel is rare, and of the
     * two mistakes, sending a duplicate cancellation to someone who has
     * already made other plans is much the worse one.
     */
    await sendEmail({
      to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      template: input.status === "CONFIRMED" ? "booking_confirmed" : "booking_cancelled",
      bookingId: booking.id,
      dedupeKey: `status:${booking.id}:${input.status}`,
    });
  } catch (e) {
    console.error("[notify] status change email failed", e);
  }
}

/**
 * What Razorpay eventually said about a refund.
 *
 * Two very different audiences:
 *
 *   processed  the customer, because money has left our account and 5–7
 *              working days of bank silence follows. Without this they check
 *              their statement that evening, see nothing, and email us.
 *   failed     the team only. A failed refund is invisible from every
 *              direction — the customer was never promised it had gone, and
 *              the FAILED row is only visible to someone who happens to open
 *              that booking. Left alone it surfaces as a chargeback.
 *
 * The customer is deliberately NOT told about a failure. They should hear a
 * decision, not a technical fault they can do nothing about; the team retries
 * and then tells them what happened.
 */
export async function notifyRefundOutcome(input: {
  bookingId: string;
  amountPaise: number;
  /** Total PROCESSED on the booking. -1 when this refund failed. */
  refundedTotalPaise: number;
  razorpayRefundId: string;
  processed: boolean;
}) {
  try {
    const booking = await loadBooking(input.bookingId);
    if (!booking) return;
    const { to, name } = recipient(booking);

    if (!input.processed) {
      const adminTo = process.env.ADMIN_NOTIFICATION_EMAIL?.trim();
      if (!adminTo) return;
      const alert = refundFailedAdminEmail({
        reference: booking.reference,
        tripTitle: booking.trip.title,
        customerEmail: to ?? "(no email on file)",
        amountPaise: input.amountPaise,
        razorpayRefundId: input.razorpayRefundId,
        reason: "Razorpay reported the refund failed",
      });
      await sendEmail({
        to: adminTo,
        subject: alert.subject,
        html: alert.html,
        text: alert.text,
        template: "admin_refund_failed",
        bookingId: booking.id,
        dedupeKey: `refund_failed:${input.razorpayRefundId}`,
      });
      return;
    }

    if (!to) return;
    const mail = refundProcessedEmail({
      name,
      reference: booking.reference,
      tripTitle: booking.trip.title,
      amountPaise: input.amountPaise,
      refundedTotalPaise: input.refundedTotalPaise,
      paidPaise: booking.amountPaidPaise,
    });

    await sendEmail({
      to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      template: "refund_processed",
      bookingId: booking.id,
      // Keyed on the refund, not the booking: two partial refunds on one
      // booking are two separate pieces of news.
      dedupeKey: `refund_processed:${input.razorpayRefundId}`,
    });
  } catch (e) {
    console.error("[notify] refund outcome email failed", e);
  }
}


/**
 * A cancelled booking whose money became travel credit.
 *
 * Its own notification rather than a branch of notifyStatusChange, because
 * the amount is not derivable from the booking: the credit can be less than
 * what was paid (a cancellation charge) or more (goodwill), and only the
 * caller knows which.
 */
export async function notifyCreditIssued(input: { bookingId: string; creditPaise: number }) {
  try {
    const booking = await loadBooking(input.bookingId);
    if (!booking) return;
    const { to, name } = recipient(booking);
    if (!to) return;

    const mail = creditIssuedEmail({
      name,
      reference: booking.reference,
      tripTitle: booking.trip.title,
      creditPaise: input.creditPaise,
      note: booking.cancellationReason,
    });

    await sendEmail({
      to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      template: "credit_issued",
      bookingId: booking.id,
      // Keyed on the booking: carrying one forward twice is not a thing, and
      // a double-clicked button must not send two of these.
      dedupeKey: `credit_issued:${booking.id}`,
    });
  } catch (e) {
    console.error("[notify] credit issued email failed", e);
  }
}


/**
 * Money the team returned by hand.
 *
 * Sent immediately, unlike the gateway path — there is no webhook to wait
 * for because the cash is already in their hand or the transfer already
 * made. The template varies its own timing sentence by method, so this only
 * has to say which one it was.
 */
export async function notifyOfflineRefund(input: {
  bookingId: string;
  amountPaise: number;
  method: string;
  reference: string | null;
}) {
  try {
    const booking = await loadBooking(input.bookingId);
    if (!booking) return;
    const { to, name } = recipient(booking);
    if (!to) return;

    const mail = refundProcessedEmail({
      name,
      reference: booking.reference,
      tripTitle: booking.trip.title,
      amountPaise: input.amountPaise,
      refundedTotalPaise: booking.refundedPaise,
      paidPaise: booking.amountPaidPaise,
      method: input.method,
      externalReference: input.reference,
    });

    await sendEmail({
      to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      template: "refund_processed",
      bookingId: booking.id,
      /**
       * Keyed on the amount and the day, not the booking.
       *
       * There is no refund id to key on — these never reach Razorpay. Two
       * genuinely separate hand-backs on one booking are two emails, while a
       * double-clicked button is one.
       */
      dedupeKey: `refund_offline:${booking.id}:${input.amountPaise}:${new Date()
        .toISOString()
        .slice(0, 10)}`,
    });
  } catch (e) {
    console.error("[notify] offline refund email failed", e);
  }
}
