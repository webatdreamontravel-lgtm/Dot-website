import { statusSettled } from "@/lib/booking/lifecycle";

export type PaymentState = "UNPAID" | "PARTIAL" | "PAID";

/**
 * The payment chip: does this booking still need money?
 *
 * It sits beside the balance figure, so it has to answer the same question
 * the balance answers — and for a while it didn't, in three separate ways.
 *
 * ── 1. What is measured, while the booking is open ──
 *
 * What we still HOLD, not what was once handed over. A confirmed booking
 * paid in full and then partly refunded owes that money again: the balance
 * card says ₹1,000 outstanding, and the chip beside it used to say "Paid in
 * full" on the same screen.
 *
 * ── 2. What is measured, once it has closed ──
 *
 * Held is meaningless on a cancelled or carried-forward booking: the money
 * has deliberately gone, and a held-based chip would call a booking that
 * took ₹31,002 "Unpaid". Nothing is owed either way, so the chip becomes
 * history — how much of the price they actually paid.
 *
 * ── 3. Never from `balancePaise` ──
 *
 * Which is where all of this started. balance is forced to zero on a closed
 * booking, so "balance is zero" got read as "they paid everything", and a
 * cancelled booking that paid half its price reported "Paid in full".
 */
export function paymentStateOf(booking: {
  status: string;
  totalPaise: number;
  amountPaidPaise: number;
  /** paid − refunded − credit carried out. What the booking still has. */
  netHeldPaise: number;
}): PaymentState {
  // Reserved for "no money ever arrived". A booking that took money and gave
  // all of it back is not the same thing as one that never took any, and
  // collapsing them loses the only fact that mattered.
  if (booking.amountPaidPaise <= 0) return "UNPAID";

  const measured = statusSettled(booking.status)
    ? booking.amountPaidPaise
    : booking.netHeldPaise;

  // >= not ===: a booking repriced smaller after a traveller dropped out can
  // sit above its own total, and that is still paid in full.
  return measured >= booking.totalPaise ? "PAID" : "PARTIAL";
}
