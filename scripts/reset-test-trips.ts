/**
 * Puts the two TEST trips back to zero.
 *
 *   npx tsx --env-file=.env.local scripts/reset-test-trips.ts
 *
 * Walking a scenario ends with seats consumed, bookings in odd states and a
 * hold or two still live. Rather than unpicking that by hand between runs —
 * which is how a test cleanup ends up damaging real data — this removes
 * everything the two test trips own and resets their seat counters.
 *
 * ── The guard ──
 *
 * The slug allowlist below is the whole safety story. Every delete is scoped
 * to trips whose id is in that set, so this cannot touch Walayar, Thekkady,
 * Wayanad or anything added later, however it is invoked. If you add a third
 * test trip, add its slug here; if you point this at a real trip, it will
 * refuse rather than do as it's told.
 *
 * Deletion order follows the foreign keys: payments and refunds are
 * onDelete: Restrict against bookings (deliberately — money rows must not
 * vanish when a booking does), so they go first. Travellers and instalments
 * cascade. Seat holds are nulled by the cascade but the rows remain, so they
 * are removed explicitly.
 *
 * razorpay_events is left alone on purpose. It is not scoped to a trip, and
 * it is what makes a replayed webhook a no-op — clearing it would quietly
 * disable the idempotency you are most likely trying to test.
 */
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../lib/generated/prisma/client.js";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

/** The only trips this script is allowed to touch. */
const TEST_SLUGS = ["kotagiri-payment-lab-test", "ooty-balance-lab-test"] as const;

async function main() {
  const trips = await prisma.trip.findMany({
    where: { slug: { in: [...TEST_SLUGS] } },
    select: { id: true, slug: true, title: true, totalSeats: true, seatsBooked: true },
  });

  if (trips.length === 0) {
    console.log("No test trips found. Run scripts/seed-test-trips.ts first.");
    return;
  }

  // Belt and braces: a title that doesn't say TEST means the slug got reused
  // for something real, and this should stop rather than guess.
  const impostor = trips.find((t) => !t.title.includes("(TEST)"));
  if (impostor) {
    throw new Error(
      `Refusing to run: "${impostor.slug}" is titled "${impostor.title}", which is not a test trip.`,
    );
  }

  const tripIds = trips.map((t) => t.id);
  const bookings = await prisma.booking.findMany({
    where: { tripId: { in: tripIds } },
    select: { id: true, reference: true },
  });
  const bookingIds = bookings.map((b) => b.id);

  const counts = { refunds: 0, payments: 0, emails: 0, bookings: 0, holds: 0 };

  if (bookingIds.length) {
    counts.refunds = (await prisma.refund.deleteMany({ where: { bookingId: { in: bookingIds } } })).count;
    counts.payments = (await prisma.payment.deleteMany({ where: { bookingId: { in: bookingIds } } })).count;
    counts.emails = (await prisma.emailLog.deleteMany({ where: { bookingId: { in: bookingIds } } })).count;
    // Travellers and instalments cascade with the booking.
    counts.bookings = (await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } })).count;
  }

  counts.holds = (await prisma.seatHold.deleteMany({ where: { tripId: { in: tripIds } } })).count;

  // seats_booked is normally owned by reserve_seats()/release_seats(). Setting
  // it directly is only safe because every hold and booking that could
  // disagree with it has just been deleted.
  await prisma.trip.updateMany({ where: { id: { in: tripIds } }, data: { seatsBooked: 0 } });

  console.log(
    `reset ${trips.length} test trip${trips.length === 1 ? "" : "s"} — ` +
      `${counts.bookings} bookings, ${counts.payments} payments, ${counts.refunds} refunds, ` +
      `${counts.holds} seat holds, ${counts.emails} emails removed`,
  );
  if (bookings.length) {
    console.log("  " + bookings.map((b) => b.reference).join(", "));
  }

  for (const slug of TEST_SLUGS) {
    const t = await prisma.trip.findUnique({
      where: { slug },
      select: { slug: true, seatsBooked: true, totalSeats: true },
    });
    if (t) console.log(`  ${t.slug.padEnd(26)} ${t.seatsBooked}/${t.totalSeats} seats booked`);
  }

  console.log("\nRe-run scripts/seed-test-trips.ts to move the departure dates back into place.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
