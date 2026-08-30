/**
 * Two trips built for walking the payment module by hand.
 *
 *   npx tsx --env-file=.env.local scripts/seed-test-trips.ts
 *
 * These are not products. They exist so every branch in the payment code can
 * be reached deliberately, one at a time, and checked against the database
 * and the Razorpay dashboard.
 *
 * ── Why two, and why these shapes ──
 *
 * PAYMENT LAB (Kotagiri) — 6 seats, far-future departure.
 *   Six seats is small enough to fill in four bookings, which is what makes
 *   the sold-out and late-authorisation paths reachable without inventing
 *   twenty travellers. The December departure keeps it outside every balance
 *   reminder offset, so the nightly cron never touches it and the seat
 *   arithmetic stays clean.
 *
 * BALANCE LAB (Ooty) — departs in three days.
 *   Three days puts it inside the daily reminder window (the final five
 *   mornings), so the reminder cron has something to find the moment it is
 *   run. Ten seats, because nothing here is about capacity.
 *
 * Prices are chosen so every derived figure is a whole rupee with no
 * rounding to reason about — ₹2,000 + 5% is ₹2,100 and ₹5,000 + 5% is
 * ₹5,250. When a number in the database looks wrong it should be wrong,
 * not rounded.
 *
 * Re-running updates the same two trips. seatsBooked is deliberately left
 * alone: it belongs to reserve_seats(), and resetting it here would desync
 * the oversell guard against live seat_holds.
 */
import { PrismaPg } from "@prisma/adapter-pg";

import { Prisma, PrismaClient } from "../lib/generated/prisma/client.js";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

type Node = Record<string, unknown>;
const t = (text: string): Node => ({ type: "text", text });
const p = (text: string): Node => ({ type: "paragraph", content: [t(text)] });
const h = (text: string, level = 4): Node => ({ type: "heading", attrs: { level }, content: [t(text)] });
const ul = (items: string[]): Node => ({
  type: "bulletList",
  content: items.map((i) => ({ type: "listItem", content: [p(i)] })),
});
const doc = (content: Node[]): Node => ({ type: "doc", content });
const json = (v: unknown) => v as Prisma.InputJsonValue;

const img = (id: string, w: number) => `https://images.unsplash.com/${id}?w=${w}&q=80`;

/** Midnight UTC, N days from today. Date columns compare as calendar days. */
function dayFromNow(days: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

const CANCELLATION = doc([
  p("A test departure. Nothing here is sold and no cancellation terms apply."),
]);

type Seed = {
  slug: string;
  title: string;
  batchName: string;
  tagline: string;
  destination: string;
  category: string;
  /** Days from today. Kept relative so a re-run always lands in the right window. */
  startsInDays: number;
  nights: number;
  durationLabel: string;
  totalSeats: number;
  pricePaise: number;
  advancePaise: number;
  heroImage: string;
  cardImage: string;
  intro: string[];
  itinerary: { title: string; body: string }[];
  inclusions: Node[];
  exclusions: string[];
  thingsToKnow: string[];
  moodboard: { label: string; value: number }[];
};

const TRIPS: Seed[] = [
  {
    slug: "kotagiri-payment-lab-test",
    title: "Kotagiri Payment Lab (TEST)",
    batchName: "TEST · payment mechanics · 6 seats",
    tagline: "A six-seat sandbox for holds, advances, full payments and sold-out",
    destination: "Kotagiri, Nilgiris",
    category: "TEST",
    // Far enough out that no reminder offset reaches it — this trip is about
    // seats and settlement, and a reminder email arriving mid-test would only
    // muddy the picture.
    startsInDays: 105,
    nights: 0,
    durationLabel: "1 Day",
    totalSeats: 6,
    // ₹2,000 + 5% GST = ₹2,100 per seat. Advance ₹500, balance ₹1,600.
    pricePaise: 200_000,
    advancePaise: 50_000,
    heroImage: img("photo-1470071459604-3b5ec3a7fe05", 1920),
    cardImage: img("photo-1544735716-392fe2489ffa", 1200),
    intro: [
      "A test departure. Six seats, a ₹500 advance and a ₹2,100 total, chosen so the seat count and the money are both small enough to hold in your head while you watch the tables change.",
      "Everything the checkout can do is reachable here: holding seats, abandoning them, paying an advance, paying in full, running out of seats, and paying after the hold has already gone.",
    ],
    itinerary: [
      { title: "Hold, pay, settle", body: "Six seats is deliberate. Two bookings of two and one of one leaves exactly one seat, which is what makes the sold-out branch reachable on purpose rather than by accident." },
    ],
    inclusions: [
      h("What this trip is for"),
      ul([
        "Seat holds and their expiry",
        "Advance and full payment at checkout",
        "Sold-out on a trip with seats still visibly free",
        "Payment landing after the hold has been released",
      ]),
    ],
    exclusions: ["An actual trip to Kotagiri"],
    thingsToKnow: [
      "₹2,000 per seat + 5% GST = ₹2,100. Advance ₹500 per seat, balance ₹1,600.",
      "Six seats total. Seats held during checkout do not count toward seats_booked until payment settles.",
      "Departs in about fifteen weeks, so balance reminders never fire for it.",
    ],
    moodboard: [
      { label: "Leisure", value: 1 },
      { label: "Nature", value: 1 },
      { label: "Adventure", value: 1 },
    ],
  },
  {
    slug: "coonoor-test-bench-test",
    title: "Coonoor Test Bench (TEST)",
    batchName: "TEST · general payment flow · 20 seats",
    tagline: "Room to run the same flow twenty times without running out of seats",
    destination: "Coonoor, Nilgiris",
    category: "TEST",
    // Two months out: past every reminder offset, so the nightly cron never
    // touches it, and far enough that nothing here ages out mid-test.
    startsInDays: 60,
    nights: 1,
    durationLabel: "2 Days, 1 Night",
    totalSeats: 20,
    // ₹4,000 + 5% GST = ₹4,200 per seat. Advance ₹1,500, balance ₹2,700.
    pricePaise: 400_000,
    advancePaise: 150_000,
    heroImage: img("photo-1470071459604-3b5ec3a7fe05", 1920),
    cardImage: img("photo-1502784444187-359ac186c5bb", 1200),
    intro: [
      "The one to come back to. Twenty seats and a two-month runway, so the same flow can be run again and again without the trip filling up or the departure creeping into the reminder window.",
      "Priced so travel credit is a partial payment rather than the whole thing — ₹4,200 a seat against a credit balance of a few thousand leaves a remainder to settle in cash, which is the case worth exercising.",
    ],
    itinerary: [
      { title: "Somewhere to keep testing", body: "Kotagiri exists to be filled and Ooty to be chased for money. This one exists to stay open — six seats and a three-day departure both run out, and re-seeding mid-investigation loses the state you were looking at." },
    ],
    inclusions: [
      h("What this trip is for"),
      ul([
        "Repeat runs of any payment path",
        "Travel credit as a partial payment",
        "Advance and balance without a reminder firing",
        "Anything needing a clean, roomy trip",
      ]),
    ],
    exclusions: ["An actual trip to Coonoor"],
    thingsToKnow: [
      "₹4,000 per seat + 5% GST = ₹4,200. Advance ₹1,500 per seat, balance ₹2,700.",
      "20 seats, so sold-out is out of reach unless you go looking for it.",
      "Departs in about two months — outside every balance reminder offset.",
    ],
    moodboard: [
      { label: "Leisure", value: 1 },
      { label: "Nature", value: 1 },
      { label: "Adventure", value: 1 },
    ],
  },
  {
    slug: "ooty-balance-lab-test",
    title: "Ooty Balance Lab (TEST)",
    batchName: "TEST · balances & reminders · departs in 3 days",
    tagline: "Departs inside the daily reminder window, so the cron has work the moment you run it",
    destination: "Ooty, Nilgiris",
    category: "TEST",
    // Three days out lands inside dailyFinalDays (5), so the balance reminder
    // cron matches it on the very first run instead of on some future morning.
    startsInDays: 3,
    nights: 1,
    durationLabel: "2 Days, 1 Night",
    totalSeats: 10,
    // ₹5,000 + 5% GST = ₹5,250 per seat. Advance ₹2,000, balance ₹3,250.
    pricePaise: 500_000,
    advancePaise: 200_000,
    heroImage: img("photo-1518002171953-a080ee817e1f", 1920),
    cardImage: img("photo-1502784444187-359ac186c5bb", 1200),
    intro: [
      "A test departure three days out. Pay the ₹2,000 advance and this booking immediately owes ₹3,250 — which is exactly what the balance flow, the reminder cron and the admin nudge button all need to have something to act on.",
      "Ten seats, because capacity is not what this one is testing.",
    ],
    itinerary: [
      { title: "Advance today, balance tomorrow", body: "The departure date is what makes this trip useful: it sits inside the final-five-mornings window, so the reminder cron finds any unpaid balance on it the first time it runs." },
    ],
    inclusions: [
      h("What this trip is for"),
      ul([
        "Advance paid, balance outstanding",
        "Paying the balance from the account page",
        "The nightly balance reminder cron",
        "The manual 'send reminder' button in admin",
      ]),
    ],
    exclusions: ["An actual trip to Ooty"],
    thingsToKnow: [
      "₹5,000 per seat + 5% GST = ₹5,250. Advance ₹2,000 per seat, balance ₹3,250.",
      "Departs in 3 days, which is inside the daily reminder window (the final 5 mornings).",
      "Move the start date to test other offsets — 14 and 21 days are the one-off nudges.",
    ],
    moodboard: [
      { label: "Leisure", value: 1 },
      { label: "Nature", value: 1 },
      { label: "Adventure", value: 1 },
    ],
  },
];

async function main() {
  for (const s of TRIPS) {
    const startDate = dayFromNow(s.startsInDays);
    const endDate = dayFromNow(s.startsInDays + s.nights);

    const content = {
      title: s.title,
      batchName: s.batchName,
      tagline: s.tagline,
      destination: s.destination,
      category: s.category,

      startDate,
      endDate,
      durationLabel: s.durationLabel,
      startingFrom: "Coimbatore",
      ageGroup: "18 - 45 years",

      heroImage: s.heroImage,
      cardImage: s.cardImage,

      totalSeats: s.totalSeats,
      minParticipants: 1,

      pricePaise: s.pricePaise,
      gstPercent: 5,
      tcsPercent: 0,
      advancePaise: s.advancePaise,
      // 0 = no instalment plan of its own. createPaymentOrder writes the
      // advance/balance pair itself when someone pays an advance.
      instalmentCount: 0,

      razorpayEnabled: true,
      autoCloseWhenFull: true,
      showSeatsLeft: true,
      // Kept off the featured rail — a test trip has no business on the
      // homepage hero.
      isFeatured: false,
      isActive: true,
      status: "PUBLISHED" as const,
      publishedAt: new Date(),

      introduction: json(doc(s.intro.map(p))),
      itinerary: json(
        s.itinerary.map((d, i) => ({
          dayNumber: i + 1,
          dayLabel: `DAY ${i + 1}`,
          date: "",
          title: d.title,
          body: doc([p(d.body)]),
          image: null,
        })),
      ),
      inclusions: json(doc(s.inclusions)),
      exclusions: json(doc([ul(s.exclusions)])),
      thingsToKnow: json(doc([ul(s.thingsToKnow)])),
      moodboard: json(s.moodboard),
      cancellationPolicy: json(CANCELLATION),
    };

    const trip = await prisma.trip.upsert({
      where: { slug: s.slug },
      update: content,
      create: { slug: s.slug, seatsBooked: 0, ...content },
      select: {
        id: true, slug: true, pricePaise: true, advancePaise: true,
        totalSeats: true, seatsBooked: true, startDate: true,
      },
    });

    const r = (paise: number) => "₹" + (paise / 100).toLocaleString("en-IN");
    const total = trip.pricePaise + Math.round((trip.pricePaise * 5) / 100);
    const days = Math.round((trip.startDate.getTime() - dayFromNow(0).getTime()) / 86_400_000);

    console.log(
      `✓ ${trip.slug.padEnd(26)} ${r(trip.pricePaise)} + 5% = ${r(total)}/seat` +
        `  advance ${r(trip.advancePaise ?? 0)}  balance ${r(total - (trip.advancePaise ?? 0))}` +
        `\n  ${" ".repeat(26)} ${trip.seatsBooked}/${trip.totalSeats} seats booked` +
        `  ·  departs in ${days} day${days === 1 ? "" : "s"} (${trip.startDate.toISOString().slice(0, 10)})`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
