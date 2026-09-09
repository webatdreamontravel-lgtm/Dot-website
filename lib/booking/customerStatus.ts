/**
 * What a booking's state means to the customer looking at it.
 *
 * Lives here rather than in a page because two screens show it — the card in
 * the account list and the booking detail page — and they had drifted: the
 * detail page knew that REQUESTED means something quite different once money
 * has arrived, and the card did not. The card cheerfully offered "Pay ₹1,600
 * now" to someone whose seat had been lost and whose ₹500 was sitting
 * unresolved.
 *
 * ── Why REQUESTED needs two readings ──
 *
 * REQUESTED is reached two ways, and they feel opposite to the person:
 *
 *   nothing paid   the team took the booking and will ring about payment.
 *                  "Request received" is exactly right.
 *   money paid     either an offline part-payment awaiting confirmation, or
 *                  a payment that landed after the seat had gone. Telling
 *                  someone who has just paid ₹500 that "our team will
 *                  contact you to arrange payment" is both wrong and
 *                  alarming.
 *
 * The amount paid is what tells them apart.
 */

import { amountOutstanding } from "@/lib/booking/balance";

export type CustomerStatus = {
  label: string;
  /** Tailwind classes for the badge. */
  tone: string;
  /** The full explanation, for the booking detail page. */
  body: string;
  /** One line, for the card in the list. Omitted when the badge says enough. */
  note?: string;
};

const NEUTRAL = "bg-navy/10 text-navy";

/**
 * Shown on any booking with a refund against it, whatever its status.
 *
 * Keyed on "has money come back", not on why — the status can't tell a
 * cancellation from a repricing from a goodwill gesture, and guessing puts
 * words in the team's mouth. This says only what is true of every refund.
 *
 * Razorpay tells us when a refund was SENT; nothing tells anyone when it
 * ARRIVES. That gap is up to a week of silence during which the only thing a
 * customer can conclude is that something went wrong — so the wait is named
 * here as well as in the email, with the same number.
 */
export const REFUND_NOTICE =
  "Refunds go back to the card or account you paid from and usually take 5 to 7 " +
  "working days from the day you received our email. If it hasn't arrived, message " +
  "us and we'll trace it.";

export function customerStatus(booking: {
  status: string;
  amountPaidPaise: number;
  /** What has actually come back. Absent on screens that don't fetch it. */
  refundedPaise?: number;
  /** Moved to their travel credit. Absent on screens that don't fetch it. */
  creditIssuedPaise?: number;
}): CustomerStatus {
  const { status, amountPaidPaise } = booking;
  const refunded = booking.refundedPaise ?? 0;
  const rupees = (p: number) =>
    "₹" + (p / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });

  if (status === "CARRIED_FORWARD") {
    /**
     * No money came back, so this must not read like a refund.
     *
     * The amount is read from the ledger entries this booking created, not
     * inferred from what was paid. Those are different numbers whenever a
     * cancellation charge or a goodwill top-up was involved, and guessing
     * would put a figure in front of the customer that nobody decided.
     */
    const carried = booking.creditIssuedPaise ?? 0;
    return {
      label: "Carried forward",
      tone: NEUTRAL,
      body:
        (carried > 0
          ? `${rupees(carried)} is being held as travel credit towards a future trip. `
          : "What you paid is being held as travel credit towards a future trip. ") +
        "It doesn't expire — tell us when you're ready to book and we'll put it " +
        "towards the cost.",
      note: carried > 0 ? `${rupees(carried)} in travel credit` : undefined,
    };
  }

  if (status === "PARTIALLY_REFUNDED") {
    /**
     * States the two figures and stops.
     *
     * It used to explain that a cancellation charge had been kept — but the
     * status only knows that paid and refunded differ, not why. A repricing
     * after a traveller drops out, a goodwill part-refund and a cancellation
     * charge all look identical here, and telling someone their money was
     * "kept as a cancellation charge" when it wasn't is the kind of sentence
     * that gets quoted back at you.
     */
    return {
      label: "Partly refunded",
      tone: NEUTRAL,
      body:
        `${rupees(refunded)} of the ${rupees(amountPaidPaise)} you paid has been ` +
        `refunded to you.`,
      note: `${rupees(refunded)} refunded`,
    };
  }

  if (status === "REQUESTED" && amountPaidPaise > 0) {
    return {
      label: "Payment received",
      tone: "bg-yellow text-navy",
      body:
        "We have your payment and one of us is confirming this booking by hand. " +
        "You'll get an email as soon as it's done — usually within one working day. " +
        "Nothing further is needed from you in the meantime.",
      note: "We have your payment — a person is confirming this booking. We'll email you.",
    };
  }

  switch (status) {
    case "REQUESTED":
      return {
        label: "Request received",
        tone: "bg-yellow text-navy",
        body: "Your seats are held. Our team will contact you to arrange payment and confirm.",
        note: "Our team will contact you to arrange payment.",
      };
    case "PENDING_PAYMENT":
      return {
        label: "Awaiting payment",
        tone: "bg-yellow text-navy",
        body: "Your seats are held until payment comes through.",
      };
    case "CONFIRMED":
      return {
        label: "Confirmed",
        tone: "bg-teal text-cream",
        body: "You're in. We'll add you to the trip WhatsApp group before departure.",
      };
    case "CANCELLED":
      return { label: "Cancelled", tone: "bg-coral text-cream", body: "This booking was cancelled." };
    case "REFUNDED":
      return {
        label: "Refunded in full",
        tone: NEUTRAL,
        body:
          amountPaidPaise > 0
            ? `The full ${rupees(amountPaidPaise)} you paid has been refunded to you.`
            : "This booking was refunded.",
      };
    case "EXPIRED":
      return {
        label: "Expired",
        tone: NEUTRAL,
        /**
         * Written for two readers at once.
         *
         * Usually this is someone who abandoned checkout, and the first
         * sentence is all they need. But a payment can reach us late — the
         * bank authorises after our hold lapsed, or the gateway retries a
         * failed delivery for up to 24 hours — and in that window this page
         * is the first thing a customer who HAS paid will look at. "The
         * seats were released" reads as "your money is gone", so the second
         * sentence is there for them.
         */
        body:
          "We didn't receive payment in time, so the seats were released. If you did pay, " +
          "it can occasionally take a few minutes to reach us — we'll confirm and email you " +
          "as soon as it does.",
      };
    default:
      return { label: status, tone: NEUTRAL, body: "" };
  }
}

/**
 * Whether to offer paying the balance online.
 *
 * CONFIRMED only, deliberately. REQUESTED means a human has not signed this
 * booking off yet — either they are collecting the money themselves, or the
 * seat needs sorting out — and taking a second payment before that is
 * resolved would make the situation harder to unpick, not easier. It also
 * risks charging someone for a seat they may not end up with.
 *
 * Once the team confirms it, the button appears on its own.
 *
 * Every closed status — CANCELLED, REFUNDED, PARTIALLY_REFUNDED, EXPIRED —
 * is excluded by the same check, so a settled booking can never be paid
 * against by accident.
 */
export function canPayBalanceOnline(booking: {
  status: string;
  totalPaise: number;
  amountPaidPaise: number;
  refundedPaise: number;
  trip: { razorpayEnabled: boolean };
}): boolean {
  return (
    booking.status === "CONFIRMED" &&
    // Refund-aware, like every other balance. Money handed back is owed
    // again, so a fully-refunded booking has a balance to settle.
    amountOutstanding(booking) > 0 &&
    // Money already in means this is a balance rather than a first payment —
    // the booking flow itself is where a first payment belongs.
    booking.amountPaidPaise > 0 &&
    booking.trip.razorpayEnabled
  );
}
