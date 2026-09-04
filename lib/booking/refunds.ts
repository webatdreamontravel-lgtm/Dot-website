/**
 * Which refunds have money spoken for.
 *
 * Three states, and only two of them tie money up:
 *
 *   PENDING    asked of Razorpay and on its way. Not gone yet, but committed
 *              — nothing else may be promised out of it.
 *   PROCESSED  gone.
 *   FAILED     refused. The money never left; it is ours again.
 *
 * ── Why this is one fact in one file ──
 *
 * The same sum was written four times and no two agreed. The Razorpay
 * ceiling on the server counted FAILED refunds (so a refund Razorpay refused
 * permanently reduced what could be sent); the same ceiling on screen didn't.
 * The by-hand ceiling — on screen AND on the server — ignored PENDING
 * entirely, so ₹1,000 already travelling back through Razorpay could be
 * handed over in cash a second time.
 *
 * `refunded_paise` is deliberately NOT this number. That column means "has
 * actually left the account", and a balance or an overpayment computed from
 * anything looser would invent money the customer owes.
 */

export const COMMITTED_REFUND_STATUSES: ReadonlySet<string> = new Set([
  "PENDING",
  "PROCESSED",
]);

export function refundCommitted(status: string): boolean {
  return COMMITTED_REFUND_STATUSES.has(status);
}

type RefundRow = { amountPaise: number; status: string };

/** Everything promised out of this booking, whether or not it has landed. */
export function committedRefundPaise(refunds: readonly RefundRow[]): number {
  return refunds.reduce((n, r) => (refundCommitted(r.status) ? n + r.amountPaise : n), 0);
}

/**
 * The part of that Razorpay is responsible for.
 *
 * Cash handed over takes nothing out of the gateway, so it must not reduce
 * what the gateway can still send — the two ceilings are different
 * quantities and were conflated once already.
 */
export function committedGatewayRefundPaise(
  refunds: readonly (RefundRow & { method: string })[],
): number {
  return refunds.reduce(
    (n, r) => (r.method === "RAZORPAY" && refundCommitted(r.status) ? n + r.amountPaise : n),
    0,
  );
}

/** Raised and not yet resolved. Blocks carrying a booking forward. */
export function pendingRefundPaise(refunds: readonly RefundRow[]): number {
  return refunds.reduce((n, r) => (r.status === "PENDING" ? n + r.amountPaise : n), 0);
}
