import "server-only";

import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Travel credit — money kept from a cancelled booking and spent on a later one.
 *
 * ── The one rule ──
 *
 * A balance is SUM(amountPaise) over that customer's entries. It is never
 * stored anywhere. A cached total sitting beside its own ledger is the worst
 * failure in this category: when the two disagree there is nothing to say
 * which one is right, and no way to reconstruct the truth afterwards.
 *
 * Entries are append-only and signed. Issuing adds, redeeming subtracts, and
 * a correction is a new ADJUSTED row rather than an edit — so what was
 * promised and what was spent both stay on the record.
 *
 * ── Credit is a payment method, not a second kind of money ──
 *
 * Spending credit writes a Payment row with method CREDIT alongside the
 * ledger entry, so a booking's paid total, balance, instalments, reminders
 * and every report handle it with no special cases. The only thing unique to
 * credit is this file.
 */

export type CreditEntryRow = {
  id: string;
  kind: "ISSUED" | "REDEEMED" | "ADJUSTED";
  amountPaise: number;
  note: string | null;
  createdAt: Date;
  sourceBooking: { reference: string; trip: { title: string } } | null;
  appliedBooking: { reference: string; trip: { title: string } } | null;
};

const entrySelect = {
  id: true,
  kind: true,
  amountPaise: true,
  note: true,
  createdAt: true,
  sourceBooking: { select: { reference: true, trip: { select: { title: true } } } },
  appliedBooking: { select: { reference: true, trip: { select: { title: true } } } },
} as const;

/** What this customer has left to spend. Zero when they have no entries. */
export async function creditBalance(
  profileId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<number> {
  const agg = await tx.creditEntry.aggregate({
    where: { profileId },
    _sum: { amountPaise: true },
  });
  return agg._sum.amountPaise ?? 0;
}

/** Balances for several customers at once, for list screens. */
export async function creditBalances(profileIds: string[]): Promise<Map<string, number>> {
  if (profileIds.length === 0) return new Map();
  const rows = await prisma.creditEntry.groupBy({
    by: ["profileId"],
    where: { profileId: { in: profileIds } },
    _sum: { amountPaise: true },
  });
  return new Map(rows.map((r) => [r.profileId, r._sum.amountPaise ?? 0]));
}

/** One customer's history, newest first. */
export async function creditHistory(profileId: string): Promise<CreditEntryRow[]> {
  return prisma.creditEntry.findMany({
    where: { profileId },
    orderBy: { createdAt: "desc" },
    select: entrySelect,
  });
}

/**
 * Several customers' histories at once, for the admin list screen.
 *
 * One query for the whole page of customers rather than one per row — the
 * ledger is opened by clicking a row, and waiting on a round trip to show
 * something the server already knows is the wrong trade.
 */
export async function creditHistories(
  profileIds: string[],
): Promise<Map<string, CreditEntryRow[]>> {
  const grouped = new Map<string, CreditEntryRow[]>();
  if (profileIds.length === 0) return grouped;

  const rows = await prisma.creditEntry.findMany({
    where: { profileId: { in: profileIds } },
    orderBy: { createdAt: "desc" },
    select: { ...entrySelect, profileId: true },
  });

  for (const { profileId, ...entry } of rows) {
    const list = grouped.get(profileId);
    if (list) list.push(entry);
    else grouped.set(profileId, [entry]);
  }
  return grouped;
}

/**
 * Carries a cancelled booking's money forward.
 *
 * Must be called INSIDE the transaction that changes the booking's status and
 * releases its seats — the credit and the cancellation are one act, and a
 * crash between them would either lose the customer's money or give it away
 * twice.
 *
 * `amountPaise` is whatever the admin typed, not a calculation. It is allowed
 * to exceed what was paid: a goodwill top-up is a real thing the team does,
 * and forcing it through a separate "adjustment" afterwards would hide it
 * from the one screen where it makes sense.
 */
export async function issueCredit(
  tx: Prisma.TransactionClient,
  input: {
    profileId: string;
    amountPaise: number;
    sourceBookingId: string;
    createdByProfileId: string;
    note?: string | null;
  },
) {
  if (!Number.isInteger(input.amountPaise) || input.amountPaise <= 0) {
    throw new Error("Travel credit must be a whole amount greater than zero.");
  }

  return tx.creditEntry.create({
    data: {
      kind: "ISSUED",
      profileId: input.profileId,
      amountPaise: input.amountPaise,
      sourceBookingId: input.sourceBookingId,
      createdByProfileId: input.createdByProfileId,
      note: input.note || null,
    },
    select: { id: true, amountPaise: true },
  });
}

/**
 * Spends credit against a booking.
 *
 * ── Why the lock ──
 *
 * Two admins on two screens can both read a ₹4,000 balance and both spend
 * ₹3,000 of it. Reading the balance and inserting the entry has to be one
 * atomic act, so this takes a row lock on the customer's profile first: the
 * second transaction waits, then re-reads a balance that already reflects
 * the first. Same shape as reserve_seats() locking the trip row.
 *
 * A database trigger refuses a negative balance underneath this, so even a
 * caller that skipped the lock cannot overspend — but it would fail with a
 * raw exception rather than the readable error below.
 */
export async function redeemCredit(
  tx: Prisma.TransactionClient,
  input: {
    profileId: string;
    amountPaise: number;
    appliedBookingId: string;
    createdByProfileId: string;
    note?: string | null;
  },
) {
  if (!Number.isInteger(input.amountPaise) || input.amountPaise <= 0) {
    throw new Error("Credit to apply must be a whole amount greater than zero.");
  }

  // Serialises everything touching this customer's balance.
  await tx.$executeRaw`SELECT id FROM profiles WHERE id = ${input.profileId}::uuid FOR UPDATE`;

  const available = await creditBalance(input.profileId, tx);
  if (input.amountPaise > available) {
    throw new Error(
      `Only ₹${(available / 100).toLocaleString("en-IN")} of travel credit is available.`,
    );
  }

  return tx.creditEntry.create({
    data: {
      kind: "REDEEMED",
      profileId: input.profileId,
      // Stored negative so the balance is a plain SUM.
      amountPaise: -input.amountPaise,
      appliedBookingId: input.appliedBookingId,
      createdByProfileId: input.createdByProfileId,
      note: input.note || null,
    },
    select: { id: true, amountPaise: true },
  });
}

/** True when the database refused because the balance would go negative. */
export function isCreditInsufficient(e: unknown): boolean {
  let node: unknown = e;
  for (let depth = 0; node && depth < 6; depth++) {
    const obj = node as { hint?: unknown; message?: unknown; cause?: unknown };
    const text = `${typeof obj.hint === "string" ? obj.hint : ""} ${
      typeof obj.message === "string" ? obj.message : ""
    }`;
    if (/CREDIT_INSUFFICIENT|balance would go negative|travel credit is available/i.test(text)) {
      return true;
    }
    node = obj.cause;
  }
  return false;
}
