import { statusSettled } from "@/lib/booking/lifecycle";

/**
 * What is still owed on a booking. One definition, for both sides.
 *
 * ── The bug this replaces ──
 *
 * The admin measured what the booking still HOLDS — paid, less anything
 * refunded or carried to credit. The customer's own pages measured
 * `total − paid` and ignored refunds entirely, so the two disagreed by
 * exactly the amount refunded:
 *
 *   total ₹1,80,000 · paid ₹1,20,000 · refunded ₹1,15,000
 *     admin     ₹1,75,000 outstanding      (we hold ₹5,000 of theirs)
 *     customer     ₹60,000 outstanding     ← and a Pay button on it
 *
 * The display half was confusing. The other half was not: the action behind
 * "Pay ₹60,000 now" used the same subtraction to size the Razorpay order, so
 * paying it in full would have taken ₹60,000 and left the booking ₹1,15,000
 * short — with the customer believing they were square.
 *
 * ── Why refunds count ──
 *
 * `amount_paid_paise` is history: it records what arrived and never goes
 * down, which is right for a receipt and wrong for a debt. Money handed back
 * is money the trip no longer has, so it is owed again.
 *
 * ── Why a closed booking owes nothing ──
 *
 * A cancelled or carried-forward booking is not going anywhere, so no amount
 * is outstanding on it. Without this a booking carried forward with a ₹200
 * cancellation charge would report ₹4,000 owed on a trip nobody is taking.
 */
export function amountOutstanding(booking: {
  status: string;
  totalPaise: number;
  amountPaidPaise: number;
  refundedPaise: number;
  /** Money that left this booking for the customer's credit ledger. */
  creditIssuedPaise?: number;
}): number {
  if (statusSettled(booking.status)) return 0;
  const held =
    booking.amountPaidPaise - booking.refundedPaise - (booking.creditIssuedPaise ?? 0);
  return Math.max(booking.totalPaise - held, 0);
}
