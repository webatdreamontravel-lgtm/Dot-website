import "server-only";

import { prisma } from "@/lib/prisma";
import { paymentsConfigured, razorpay } from "@/lib/payments/client";

/**
 * Razorpay settlements, and what they were made of.
 *
 * Everything that talks to the settlements API lives here, so the screens stay
 * ignorant of the SDK the same way they are of Prisma — see lib/queries/admin.ts.
 *
 */

/** Mirrors the SDK's RazorpaySettlement, narrowed to what the screens use. */
export type Settlement = {
  id: string;
  status: string;
  amount: number;
  fees: number | null;
  tax: number | null;
  utr: string | null;
  createdAt: Date;
};

/** One transaction inside a settlement, from the recon report. */
export type ReconRow = {
  entityId: string;
  type: string;
  debit: number;
  credit: number;
  amount: number;
  fee: number;
  tax: number;
  settledAt: Date | null;
  paymentId: string | null;
  orderId: string | null;
  method: string | null;
  description: string | null;
};

/** A recon row joined to the booking it paid for, where we can find one. */
export type ReconRowWithBooking = ReconRow & {
  booking: {
    reference: string;
    tripTitle: string;
    customerName: string | null;
    customerEmail: string | null;
  } | null;
};

export class SettlementsUnavailableError extends Error {}

/**
 * Razorpay deals in seconds; JS dates are milliseconds.
 *
 * `to` is pushed to the last second of the day it names. Without that, a range
 * ending "2026-09-05" excludes everything settled that day, because the raw
 * conversion lands on midnight — the range would end before the day began.
 */
function toEpochSeconds(date: string, endOfDay = false): number | undefined {
  if (!date) return undefined;
  const ms = Date.parse(endOfDay ? `${date}T23:59:59.999Z` : `${date}T00:00:00.000Z`);
  return Number.isNaN(ms) ? undefined : Math.floor(ms / 1000);
}

function toSettlement(raw: {
  id: string;
  status: string;
  amount: number | string;
  fees: number | null;
  tax: number | null;
  utr: string | null;
  created_at: number;
}): Settlement {
  return {
    id: raw.id,
    status: raw.status,
    amount: Number(raw.amount),
    fees: raw.fees,
    tax: raw.tax,
    utr: raw.utr,
    createdAt: new Date(raw.created_at * 1000),
  };
}

/**
 * A page of settlements.
 *
 * Razorpay returns no grand total — a collection's `count` is how many items
 * came back, not how many exist. So "page 4 of 12" cannot be rendered. One
 * extra row is requested and trimmed, which is enough to know whether a next
 * page exists, and that is all a prev/next pager needs.
 */
export async function listSettlements({
  from,
  to,
  page = 1,
  perPage = 25,
}: {
  from?: string;
  to?: string;
  page?: number;
  perPage?: number;
}): Promise<{ rows: Settlement[]; page: number; perPage: number; hasMore: boolean }> {
  if (!paymentsConfigured()) throw new SettlementsUnavailableError("Razorpay is not configured.");

  // The API caps count at 100; leave room for the +1 probe row.
  const size = Math.min(Math.max(perPage, 1), 99);
  const skip = (Math.max(page, 1) - 1) * size;

  const res = await razorpay().settlements.all({
    ...(toEpochSeconds(from ?? "") !== undefined ? { from: toEpochSeconds(from ?? "") } : {}),
    ...(toEpochSeconds(to ?? "", true) !== undefined ? { to: toEpochSeconds(to ?? "", true) } : {}),
    count: size + 1,
    skip,
  });

  const items = (res.items ?? []).map(toSettlement);

  return {
    rows: items.slice(0, size),
    page: Math.max(page, 1),
    perPage: size,
    hasMore: items.length > size,
  };
}

/**
 * One settlement by id, or null.
 *
 * Null rather than a throw for a bad id: a mistyped settlement reference is an
 * ordinary thing to do in a search box, and it should render "not found", not
 * an error page.
 */
export async function getSettlement(id: string): Promise<Settlement | null> {
  if (!paymentsConfigured()) throw new SettlementsUnavailableError("Razorpay is not configured.");

  try {
    const raw = await razorpay().settlements.fetch(id.trim());
    return toSettlement(raw as Parameters<typeof toSettlement>[0]);
  } catch (e) {
    const status = (e as { statusCode?: number })?.statusCode;
    if (status === 400 || status === 404) return null;
    throw e;
  }
}

/**
 * The transactions that made up a settlement.
 *
 * The recon report is keyed by YEAR AND MONTH, not by settlement id — so this
 * derives the month from the settlement's own date, walks that month's report,
 * and keeps the rows whose settlement_id matches. A month can hold thousands
 * of transactions across many settlements, hence the paging.
 */
export async function getSettlementRecon(settlement: Settlement): Promise<ReconRow[]> {
  if (!paymentsConfigured()) throw new SettlementsUnavailableError("Razorpay is not configured.");

  const year = settlement.createdAt.getUTCFullYear();
  const month = settlement.createdAt.getUTCMonth() + 1;

  const matched: ReconRow[] = [];
  const pageSize = 1000; // the API's maximum
  // A month with more than 20k transactions would be a wonderful problem; the
  // cap is here so a surprise can't turn into an unbounded loop.
  for (let skip = 0; skip < 20_000; skip += pageSize) {
    const res = await razorpay().settlements.reports({ year, month, count: pageSize, skip });

    // The SDK types this as a single object, but the endpoint returns a
    // collection — trust the shape at runtime rather than the declaration.
    const items = ((res as unknown as { items?: unknown[] }).items ?? []) as Array<
      Record<string, unknown>
    >;

    for (const row of items) {
      if (row.settlement_id !== settlement.id) continue;
      matched.push({
        entityId: String(row.entity_id ?? ""),
        type: String(row.type ?? ""),
        debit: Number(row.debit ?? 0),
        credit: Number(row.credit ?? 0),
        amount: Number(row.amount ?? 0),
        fee: Number(row.fee ?? 0),
        tax: Number(row.tax ?? 0),
        settledAt: row.settled_at ? new Date(Number(row.settled_at) * 1000) : null,
        paymentId: (row.payment_id as string) ?? null,
        orderId: (row.order_id as string) ?? null,
        method: (row.method as string) ?? null,
        description: (row.description as string) ?? null,
      });
    }

    if (items.length < pageSize) break;
  }

  return matched;
}

/**
 * Attaches our booking to each recon row.
 *
 * This is the point of the whole screen. Razorpay can say a settlement
 * contained fourteen payments; only we can say which trips and which people
 * those were.
 *
 * Matched on razorpayPaymentId then razorpayOrderId — both unique on Payment
 * (prisma/schema.prisma). A row that matches neither is returned with
 * `booking: null` rather than dropped: money in a settlement we cannot account
 * for is exactly what someone needs to see.
 *
 * `entityId` is included among the payment candidates because the recon report
 * frequently leaves `payment_id` EMPTY and puts the `pay_…` reference in
 * `entity_id` instead — verified against live report rows, where every payment
 * row had `payment_id: ""` and `entity_id: "pay_TVG6Ehi2QxraNH"`. Joining on
 * `payment_id` alone would have matched almost nothing and looked, on screen,
 * exactly like "none of this settlement was ours".
 */
export async function attachBookings(rows: ReconRow[]): Promise<ReconRowWithBooking[]> {
  const paymentIds = rows
    .flatMap((r) => [r.paymentId, r.entityId.startsWith("pay_") ? r.entityId : null])
    .filter((v): v is string => Boolean(v));
  const orderIds = rows.map((r) => r.orderId).filter((v): v is string => Boolean(v));

  if (paymentIds.length === 0 && orderIds.length === 0) {
    return rows.map((r) => ({ ...r, booking: null }));
  }

  const payments = await prisma.payment.findMany({
    where: {
      OR: [
        ...(paymentIds.length ? [{ razorpayPaymentId: { in: paymentIds } }] : []),
        ...(orderIds.length ? [{ razorpayOrderId: { in: orderIds } }] : []),
      ],
    },
    select: {
      razorpayPaymentId: true,
      razorpayOrderId: true,
      booking: {
        select: {
          reference: true,
          trip: { select: { title: true } },
          profile: { select: { fullName: true, email: true } },
        },
      },
    },
  });

  const byKey = new Map<string, ReconRowWithBooking["booking"]>();
  for (const p of payments) {
    const booking = p.booking
      ? {
          reference: p.booking.reference,
          tripTitle: p.booking.trip?.title ?? "—",
          customerName: p.booking.profile?.fullName ?? null,
          customerEmail: p.booking.profile?.email ?? null,
        }
      : null;
    if (p.razorpayPaymentId) byKey.set(p.razorpayPaymentId, booking);
    if (p.razorpayOrderId) byKey.set(p.razorpayOrderId, booking);
  }

  // Payment id first, then the entity id it hides behind, then the order.
  return rows.map((r) => ({
    ...r,
    booking:
      (r.paymentId ? byKey.get(r.paymentId) : null) ??
      byKey.get(r.entityId) ??
      (r.orderId ? byKey.get(r.orderId) : null) ??
      null,
  }));
}

/** Chip tone for a settlement status. */
export function settlementTone(status: string): { tone: string; label: string } {
  switch (status) {
    case "processed":
      return { tone: "ok", label: "Settled" };
    case "partially_processed":
      return { tone: "warn", label: "Part settled" };
    case "initiated":
      return { tone: "warn", label: "On its way" };
    case "created":
      return { tone: "mute", label: "Created" };
    case "failed":
      return { tone: "bad", label: "Failed" };
    case "reversed":
      return { tone: "bad", label: "Reversed" };
    default:
      return { tone: "mute", label: status };
  }
}
