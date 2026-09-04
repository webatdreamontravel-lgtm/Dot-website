import type { BookingStatus } from "@/lib/generated/prisma/enums";

/**
 * Which booking statuses are still open, and which have closed.
 *
 * One fact, in one place, because three things depend on it and they had
 * started to drift: the admin read model computed it inline as a negated
 * array literal, the status panel offered every value in the enum, and the
 * carry-forward action guarded only against its own status.
 *
 * ── Why closed means closed ──
 *
 * The four settled statuses each record HOW a booking ended, and the columns
 * that say so are single-valued: `cancelled_at`, `cancellation_reason`,
 * `confirmed_at`. Moving a closed booking back to an open status overwrites
 * them, so the record no longer shows that it was ever cancelled. Worse,
 * CARRIED_FORWARD sent money to the credit ledger — reopening it and
 * carrying it forward a second time issues that credit twice from the same
 * payment.
 *
 * Neither is recoverable afterwards, which is why this is enforced in the
 * server actions and not only in the panel that calls them.
 *
 * This governs the admin's hand only. The automated paths — settlement
 * confirming a PENDING_PAYMENT booking, the cron expiring a lapsed hold —
 * all move out of open statuses, never into them, so none of them meet
 * this check.
 */
export const OPEN_STATUSES: ReadonlySet<BookingStatus> = new Set<BookingStatus>([
  "PENDING_PAYMENT",
  "REQUESTED",
  "CONFIRMED",
]);

/** Still live: money can still move and the status can still be changed. */
export function statusOpen(status: BookingStatus | string): boolean {
  return OPEN_STATUSES.has(status as BookingStatus);
}

/** Closed: CANCELLED, REFUNDED, PARTIALLY_REFUNDED, CARRIED_FORWARD, EXPIRED. */
export function statusSettled(status: BookingStatus | string): boolean {
  return !statusOpen(status);
}

/**
 * A customer is at the till right now.
 *
 * PENDING_PAYMENT covers two quite different things: someone with a Razorpay
 * window open this minute, and someone who wandered off half an hour ago and
 * whose hold has since lapsed. Only the first is dangerous to touch — an
 * admin recording cash, changing the status or removing a seat while the
 * card is being charged races a payment that is already in flight, and
 * whichever lands second silently overwrites the other.
 *
 * ── Why this is derived, not a status of its own ──
 *
 * The difference between the two is the clock, and a clock is not a state
 * machine. A PAYMENT_PROCESSING enum value would need something to move
 * bookings back out of it — a cron, a webhook, a timer — and anything that
 * can stall would leave real bookings frozen with no way in. The hold's own
 * expiry already says it, exactly, with nothing to keep in sync: the moment
 * it passes, this is false again and the booking is ordinary.
 *
 * It is the same fact `trip_seats_available()` uses to free the seat
 * (`expires_at > now()`), so the lock and the seat lapse together.
 */
export function checkoutInFlight(
  booking: { status: string; holdExpiresAt: Date | null },
  now: Date = new Date(),
): boolean {
  return (
    booking.status === "PENDING_PAYMENT" &&
    booking.holdExpiresAt !== null &&
    booking.holdExpiresAt > now
  );
}

/** Whole minutes left on the hold, floored at 1 so it never reads "0 minutes". */
export function checkoutMinutesLeft(
  holdExpiresAt: Date | null,
  now: Date = new Date(),
): number {
  if (!holdExpiresAt) return 0;
  return Math.max(1, Math.ceil((holdExpiresAt.getTime() - now.getTime()) / 60_000));
}
