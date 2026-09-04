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
