import "server-only";

import type { Prisma } from "@/lib/generated/prisma/client";
import { buildReference, referencePrefix, referenceSequence } from "@/lib/booking/pricing";

/**
 * The next unused booking reference for a trip.
 *
 * Derived from the HIGHEST reference that already exists, not from a row
 * count. Counting is wrong as soon as the sequence has a gap — bookings
 * numbered 1, 2, 3, 5 make count() return 4, which collides with 5 and
 * fails the unique index. Gaps are normal: a superseded booking gets
 * removed, an import skips a number, a row is deleted in support.
 *
 * Matched on the reference prefix rather than the trip id, because the
 * unique constraint is on `reference` across the whole table — two trips
 * whose slug and year happen to agree would otherwise hand out the same
 * number.
 *
 * Must be called inside the transaction that holds the trip row lock (the
 * one reserve_seats takes), so no concurrent booking for the same trip can
 * read the same maximum.
 */
export async function nextBookingReference(
  tx: Prisma.TransactionClient,
  trip: { slug: string; startDate: Date },
): Promise<string> {
  const prefix = referencePrefix(trip.slug, trip.startDate);

  // Lexicographic ordering is safe here: the suffix is zero-padded to a
  // fixed width, so "0010" sorts after "0009" as a string too.
  const latest = await tx.booking.findFirst({
    where: { reference: { startsWith: prefix } },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });

  const next = latest ? referenceSequence(latest.reference) + 1 : 1;
  return buildReference(trip.slug, trip.startDate, next);
}
