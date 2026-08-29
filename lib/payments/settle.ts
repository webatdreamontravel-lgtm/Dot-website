import "server-only";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/send";
import {
  bookingConfirmedEmail,
  seatUnavailableAdminEmail,
  seatUnavailableEmail,
} from "@/lib/email/templates";

export type SettleInput = {
  /** Razorpay order id — how we find our own Payment row. */
  orderId: string;
  /** Razorpay payment id. Unique in our schema; the second dedupe layer. */
  paymentId: string;
  amountPaise: number;
  /** True only when an HMAC over the payload was checked and matched. */
  signatureVerified: boolean;
  /** "card", "upi", "netbanking"… purely for the record. */
  methodLabel?: string | null;
};

export type SettleResult =
  | { ok: true; state: "SETTLED" | "ALREADY_SETTLED"; bookingId: string; reference: string }
  | { ok: true; state: "SEAT_LOST"; bookingId: string; reference: string }
  | { ok: false; error: string; code: "UNKNOWN_ORDER" | "AMOUNT_MISMATCH" };

/**
 * Turns a successful Razorpay payment into a confirmed booking.
 *
 * This is the ONLY place that happens. The browser callback and the webhook
 * both land here, because a customer can close the tab the instant they pay —
 * if confirmation depended on the browser calling us back, that booking would
 * sit unpaid while the money sat in Razorpay. The webhook is the reliable
 * path; the callback just makes the happy case feel instant.
 *
 * Consequently this must be safe to run any number of times, from either
 * direction, possibly at the same moment. Three things make it so:
 *
 *   1. The caller has already deduped by event id (razorpay_events.event_id).
 *   2. The conditional claim below — an UPDATE guarded on `status <> CAPTURED`.
 *      Under READ COMMITTED, a second concurrent transaction blocks on the row
 *      lock and then re-evaluates its WHERE against the committed row, so it
 *      matches nothing and reports zero rows changed. Exactly one caller wins.
 *   3. payments.razorpay_payment_id is UNIQUE, so even a bug upstream can't
 *      credit one payment to two bookings.
 */
export async function settlePayment(input: SettleInput): Promise<SettleResult> {
  const payment = await prisma.payment.findUnique({
    where: { razorpayOrderId: input.orderId },
    select: {
      id: true, bookingId: true, amountPaise: true, status: true,
      convenienceFeePaise: true,
      booking: { select: { reference: true } },
    },
  });

  if (!payment) {
    // An order we never created. Either a webhook for a different environment
    // sharing the same secret, or something forged. Neither is ours to act on.
    return { ok: false, error: `No payment found for order ${input.orderId}`, code: "UNKNOWN_ORDER" };
  }

  /**
   * A captured amount that is LARGER than the order is expected, not an error.
   *
   * Razorpay's "Customer pays the fee" setting adds their platform fee at
   * checkout, so the customer is charged more than the order we created. The
   * extra is theirs, not ours — we are settled the order amount either way.
   *
   * Being charged LESS is a genuine disagreement and still refused: it would
   * mean crediting a booking with money that never arrived.
   */
  if (input.amountPaise < payment.amountPaise) {
    return {
      ok: false,
      code: "AMOUNT_MISMATCH",
      error:
        `Order ${input.orderId} was for ${payment.amountPaise} paise but only ` +
        `${input.amountPaise} was captured.`,
    };
  }

  // Whatever the customer was charged above the order amount is the gateway's
  // fee. Recorded for visibility; never credited to the booking.
  const gatewayFeePaise = Math.max(input.amountPaise - payment.amountPaise, 0);

  const outcome = await prisma.$transaction(async (tx) => {
    // ── The claim. Whoever changes a row here owns the settlement. ──
    const claimed = await tx.payment.updateMany({
      where: { id: payment.id, status: { not: "CAPTURED" } },
      data: {
        status: "CAPTURED",
        razorpayPaymentId: input.paymentId,
        signatureVerified: input.signatureVerified,
        capturedAt: new Date(),
        // What the customer paid on top, per Razorpay's fee-bearer setting.
        convenienceFeePaise: gatewayFeePaise,
        notes: input.methodLabel ? `Paid by ${input.methodLabel}` : null,
      },
    });

    if (claimed.count === 0) return { state: "ALREADY_SETTLED" as const };

    const booking = await tx.booking.findUniqueOrThrow({
      where: { id: payment.bookingId },
      select: {
        id: true, tripId: true, status: true, seats: true, totalPaise: true,
        amountPaidPaise: true, pendingHoldId: true,
      },
    });

    // ── Count the seats ──
    // Held since the order was created; this is where they become real.
    let seatLost = false;

    if (booking.pendingHoldId) {
      try {
        await tx.$executeRaw`SELECT confirm_seat_hold(${booking.pendingHoldId}::uuid, ${booking.id}::uuid)`;
      } catch (e) {
        if (!isHoldGone(e)) throw e;
        seatLost = true;
      }
    }

    /**
     * The late-authorisation case.
     *
     * Razorpay calls this "Late Auth": the customer starts paying, our hold
     * lapses, and the bank approves the charge minutes later. By then the
     * cron may have released the hold and cleared pendingHoldId, so there is
     * no hold left to confirm — and without this the booking would be marked
     * CONFIRMED, the money counted, and the seat never taken. The trip would
     * believe it still had a seat it had actually sold.
     *
     * They have paid, so they get a seat if one exists. The WHERE clause is
     * the guard: it can only ever take a seat the trip genuinely has, so two
     * late payments racing for one remaining seat cannot both win.
     */
    if (!booking.pendingHoldId || seatLost) {
      const claimed = await tx.$executeRaw`
        UPDATE trips
           SET seats_booked = seats_booked + ${booking.seats},
               updated_at   = now()
         WHERE id = ${booking.tripId}::uuid
           AND seats_booked + ${booking.seats} <= total_seats`;

      // Nothing updated means the trip really is full. We are holding their
      // money with no seat to give, and there is no correct automatic
      // answer — refunding silently would be worse than telling someone. The
      // booking is parked as REQUESTED with a note, which is a state the team
      // already knows how to work.
      seatLost = claimed === 0;
    }

    /**
     * Credit the ORDER amount, not what the card was charged.
     *
     * With Razorpay bearing-the-fee-to-customer, the captured amount includes
     * their platform fee — money that goes to them, not to us. Crediting it
     * would make every online booking look overpaid, leave a permanent
     * phantom balance, and have bookings_refund_within_paid guard a figure
     * that was never ours to refund.
     *
     * payment.amountPaise is what WE created the order for, so it is right
     * regardless of what the gateway added on top.
     */
    const paid = booking.amountPaidPaise + payment.amountPaise;

    await tx.booking.update({
      where: { id: booking.id },
      data: {
        amountPaidPaise: paid,
        // Mirrors recordPayment() in the admin so the online and offline
        // paths leave a booking in exactly the same shape.
        status: seatLost ? "REQUESTED" : "CONFIRMED",
        confirmedAt: seatLost ? null : new Date(),
        // Not pending any more, either way.
        pendingHoldId: null,
        holdExpiresAt: null,
        ...(seatLost
          ? {
              internalNotes:
                "⚠ Paid, but the seat hold expired and the trip filled before " +
                "the payment landed. Find a seat or refund.",
            }
          : {}),
      },
    });

    // Settle the earliest unpaid instalment this covers.
    const instalment = await tx.bookingInstalment.findFirst({
      where: { bookingId: booking.id, status: "PENDING" },
      orderBy: { sequence: "asc" },
      select: { id: true },
    });
    if (instalment) {
      await tx.bookingInstalment.update({
        where: { id: instalment.id },
        data: { status: "PAID", paidAt: new Date() },
      });
      await tx.payment.update({
        where: { id: payment.id },
        data: { instalmentId: instalment.id },
      });
    }

    await tx.auditLog.create({
      data: {
        action: seatLost ? "payment.captured_seat_lost" : "payment.captured",
        entity: "booking",
        entityId: booking.id,
        after: {
          razorpayPaymentId: input.paymentId,
          amountPaise: input.amountPaise,
          paidTotalPaise: paid,
        },
      },
    });

    return { state: seatLost ? ("SEAT_LOST" as const) : ("SETTLED" as const) };
  });

  // Deliberately outside the transaction: a Resend outage must not roll back
  // a payment we've already taken. sendEmail dedupes on its own key, so a
  // webhook retry that gets this far still sends only once.
  if (outcome.state === "SETTLED") {
    await notifyConfirmed(payment.bookingId, input.paymentId);
  } else if (outcome.state === "SEAT_LOST") {
    // Silence is the worst possible answer here — they have paid and have no
    // seat. Tell them before they find out by opening the app.
    await notifySeatUnavailable(payment.bookingId, input.paymentId);
  }

  return {
    ok: true,
    state: outcome.state,
    bookingId: payment.bookingId,
    reference: payment.booking.reference,
  };
}

/** confirm_seat_hold()'s two "the hold is gone" failures. */
function isHoldGone(e: unknown): boolean {
  let node: unknown = e;
  for (let depth = 0; node && depth < 6; depth++) {
    const obj = node as { hint?: unknown; message?: unknown; cause?: unknown };
    const hint = typeof obj.hint === "string" ? obj.hint : "";
    const msg = typeof obj.message === "string" ? obj.message : "";
    if (/HOLD_UNAVAILABLE|HOLD_EXPIRED_TRIP_FULL|INSUFFICIENT_SEATS/.test(hint + msg)) return true;
    if (/hold not found|hold expired|trip is full/i.test(msg)) return true;
    node = obj.cause;
  }
  return false;
}

async function notifyConfirmed(bookingId: string, razorpayPaymentId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      reference: true, seats: true, totalPaise: true, amountPaidPaise: true,
      trip: { select: { title: true, slug: true, startDate: true, endDate: true, startingFrom: true } },
      travellers: { where: { cancelledAt: null }, select: { fullName: true, email: true }, orderBy: { createdAt: "asc" } },
      profile: { select: { email: true, fullName: true } },
    },
  });
  if (!booking) return;

  const to = booking.profile.email ?? booking.travellers[0]?.email;
  if (!to) return;

  const mail = bookingConfirmedEmail({
    name: booking.profile.fullName ?? booking.travellers[0]?.fullName ?? "there",
    reference: booking.reference,
    tripTitle: booking.trip.title,
    tripSlug: booking.trip.slug,
    startDate: booking.trip.startDate,
    endDate: booking.trip.endDate,
    startingFrom: booking.trip.startingFrom,
    seats: booking.seats,
    paidPaise: booking.amountPaidPaise,
    totalPaise: booking.totalPaise,
  });

  await sendEmail({
    to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    template: "booking_confirmed",
    bookingId,
    // Keyed on the payment, not the booking: a second instalment on the same
    // booking is a different email and should still send.
    dedupeKey: `booking_confirmed:${razorpayPaymentId}`,
  });
}

/**
 * Paid, but no seat. Two mails: one to the customer, one to the team.
 *
 * The customer's mail exists because the alternative is them discovering it
 * themselves. The team's exists because this is the one payment outcome that
 * cannot be resolved by code — someone has to either find a seat or refund.
 */
async function notifySeatUnavailable(bookingId: string, razorpayPaymentId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      reference: true, amountPaidPaise: true,
      trip: { select: { title: true } },
      travellers: {
        where: { cancelledAt: null },
        select: { fullName: true, email: true, phone: true },
        orderBy: { createdAt: "asc" },
      },
      profile: { select: { email: true, fullName: true, phone: true } },
    },
  });
  if (!booking) return;

  const to = booking.profile.email ?? booking.travellers[0]?.email;
  if (to) {
    const mail = seatUnavailableEmail({
      name: booking.profile.fullName ?? booking.travellers[0]?.fullName ?? "there",
      reference: booking.reference,
      tripTitle: booking.trip.title,
      paidPaise: booking.amountPaidPaise,
    });
    await sendEmail({
      to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      template: "booking_seat_unavailable",
      bookingId,
      dedupeKey: `seat_unavailable:${razorpayPaymentId}`,
    });
  }

  const adminTo = process.env.ADMIN_NOTIFICATION_EMAIL?.trim();
  if (!adminTo) return;

  const alert = seatUnavailableAdminEmail({
    reference: booking.reference,
    tripTitle: booking.trip.title,
    customerEmail: to ?? "(no email on file)",
    customerPhone: booking.profile.phone ?? booking.travellers[0]?.phone ?? null,
    paidPaise: booking.amountPaidPaise,
  });
  await sendEmail({
    to: adminTo,
    subject: alert.subject,
    html: alert.html,
    text: alert.text,
    template: "admin_seat_unavailable",
    bookingId,
    dedupeKey: `admin_seat_unavailable:${razorpayPaymentId}`,
  });
}
