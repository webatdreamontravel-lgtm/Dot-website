import type { BookingStatus } from "@/lib/generated/prisma/enums";

/**
 * Which booking statuses already count toward `trips.seats_booked`.
 *
 * One fact, in one place, because every seat adjustment in the codebase
 * depends on it and the two that disagreed produced a genuine oversell: the
 * admin file knew this and the settlement path did not, so paying a balance
 * on an already-confirmed booking claimed a *second* seat for the same
 * traveller.
 *
 * PENDING_PAYMENT is deliberately absent. Those seats are spoken for by a
 * row in `seat_holds`, not by the counter — counting them in both places
 * would take the same seat twice. CANCELLED, REFUNDED and EXPIRED have all
 * given their seats back.
 *
 * Note this is a statement about the counter, not about fairness: a booking
 * parked in REQUESTED after losing its seat to a late payment reads as
 * "seated" here even though it has no seat. That is the safe direction —
 * it can only ever decline to claim a seat, never claim one twice — and
 * that booking is already flagged for a human to resolve.
 */
export const SEAT_COUNTED_STATUSES: ReadonlySet<BookingStatus> = new Set<BookingStatus>([
  "REQUESTED",
  "CONFIRMED",
]);

export function seatsCounted(status: BookingStatus | string): boolean {
  return SEAT_COUNTED_STATUSES.has(status as BookingStatus);
}
