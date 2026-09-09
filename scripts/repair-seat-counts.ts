/**
 * Recomputes trips.seats_booked from the bookings that actually hold seats.
 *
 *   npm run repair:seats            # dry run — prints what it would change
 *   npm run repair:seats -- --apply # writes
 *
 * ── Why this needs to exist ──
 *
 * seats_booked is the one figure in the system that is stored rather than
 * derived. It has to be: two customers paying for the last seat at the same
 * moment would both COUNT six of seven free and both take it, so capacity is
 * checked against a column Postgres can lock, not against a query.
 *
 * The cost of that choice is that every path adding or removing a seat has to
 * be right forever, and one that adds without a matching remove leaves the
 * counter permanently high — which reads as "sold out" on a trip with seats
 * to sell. This puts the counter back in step with the bookings.
 *
 * ── What "holds a seat" means ──
 *
 * REQUESTED and CONFIRMED, from SEAT_COUNTED_STATUSES — the same set every
 * seat adjustment in the codebase uses, so this repair and the code that
 * maintains the counter cannot disagree about what they are counting.
 *
 * Live seat_holds are deliberately NOT included. A hold is counted separately
 * by trip_seats_available(), and adding it here would take the same seat
 * twice. That does mean a trip with checkouts in flight is repaired to a
 * counter that excludes them — which is correct, and what the code expects.
 */
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../lib/generated/prisma/client.js";
import { SEAT_COUNTED_STATUSES } from "../lib/booking/seats";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const apply = process.argv.includes("--apply");

async function main() {
  const trips = await prisma.trip.findMany({
    where: { deletedAt: null },
    select: {
      id: true, slug: true, title: true, seatsBooked: true, totalSeats: true,
      bookings: { select: { status: true, seats: true } },
    },
    orderBy: { startDate: "asc" },
  });

  const drifted = trips
    .map((t) => ({
      ...t,
      correct: t.bookings
        .filter((b) => SEAT_COUNTED_STATUSES.has(b.status))
        .reduce((n, b) => n + b.seats, 0),
    }))
    .filter((t) => t.correct !== t.seatsBooked);

  if (drifted.length === 0) {
    console.log("Every trip's counter already matches its bookings. Nothing to do.");
    return;
  }

  console.log(`${drifted.length} trip(s) out of step:\n`);
  console.log("trip                             now   correct   change   bookings holding seats");
  for (const t of drifted) {
    const held = t.bookings.filter((b) => SEAT_COUNTED_STATUSES.has(b.status)).length;
    const d = t.correct - t.seatsBooked;
    console.log(
      `${t.title.slice(0, 31).padEnd(32)} ${String(t.seatsBooked).padStart(3)}   ${String(t.correct).padStart(7)}   ` +
        `${(d > 0 ? "+" : "") + d}`.padStart(6) +
        `   ${held} of ${t.bookings.length}` +
        (t.seatsBooked >= t.totalSeats && t.correct < t.totalSeats ? "   ← reads SOLD OUT and isn't" : ""),
    );
  }

  if (!apply) {
    console.log("\nDry run. Re-run with --apply to write these.");
    return;
  }

  /**
   * One transaction, with the trip row locked before it is read.
   *
   * A booking settling mid-repair would otherwise increment a counter this
   * script is about to overwrite, and its seat would vanish. The lock makes
   * reserve_seats() and confirm_seat_hold() wait their turn.
   */
  const changed: string[] = [];
  await prisma.$transaction(async (tx) => {
    for (const t of drifted) {
      await tx.$executeRaw`SELECT id FROM trips WHERE id = ${t.id}::uuid FOR UPDATE`;
      const fresh = await tx.booking.findMany({
        where: { tripId: t.id },
        select: { status: true, seats: true },
      });
      const correct = fresh
        .filter((b) => SEAT_COUNTED_STATUSES.has(b.status))
        .reduce((n, b) => n + b.seats, 0);
      const before = (
        await tx.trip.findUniqueOrThrow({ where: { id: t.id }, select: { seatsBooked: true } })
      ).seatsBooked;
      if (before === correct) continue;
      await tx.trip.update({ where: { id: t.id }, data: { seatsBooked: correct } });
      changed.push(`  ${t.slug}: ${before} → ${correct}`);
    }
  });

  console.log(`\nWrote ${changed.length} trip(s):`);
  for (const c of changed) console.log(c);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
