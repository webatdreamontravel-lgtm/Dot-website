/**
 * Migrates the hand-maintained arrays in lib/data/ into the database.
 *
 *   npm run db:seed
 *
 * Imports the real modules rather than restating their contents, so this
 * can't drift from the source. Idempotent: re-running updates content but
 * never clobbers live booking counts.
 */
import { PrismaPg } from "@prisma/adapter-pg";

import { testimonials } from "../lib/data/pastTrips";
import { trips as staticTrips } from "../lib/data/trips";
import { Prisma, PrismaClient } from "../lib/generated/prisma/client.js";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

// ─────────────────────────────────────────────────────────────
// Tiptap document builders
//
// The admin editor reads and writes ProseMirror JSON, so the seeded
// content has to be in that shape from the start — otherwise the first
// edit of a seeded trip would blow away the original text.
// ─────────────────────────────────────────────────────────────

type Node = Record<string, unknown>;

const text = (value: string): Node => ({ type: "text", text: value });

const paragraph = (value: string): Node =>
  value.trim() ? { type: "paragraph", content: [text(value)] } : { type: "paragraph" };

const heading = (value: string, level = 3): Node => ({
  type: "heading",
  attrs: { level },
  content: [text(value)],
});

/** Blank lines in the source prose become paragraph breaks. */
const prose = (value: string): Node[] =>
  value
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => paragraph(block.replace(/\n/g, " ")));

const bulletList = (items: string[]): Node => ({
  type: "bulletList",
  content: items.map((item) => ({
    type: "listItem",
    content: [paragraph(item)],
  })),
});

const doc = (content: Node[]): Node => ({ type: "doc", content });

const rupeesToPaise = (rupees: number) => Math.round(rupees * 100);

/** Narrows a built node tree to what Prisma accepts for a Json column. */
const json = (value: unknown) => value as Prisma.InputJsonValue;

/**
 * The static trips were written for a season that has already passed, so
 * every one of them fails the "upcoming" filter and the site renders empty.
 * Shift them forward, preserving each trip's real duration, so there is
 * something bookable to test against.
 */
const DAY = 24 * 60 * 60 * 1000;
function futureDates(start: string, end: string, offsetDays: number) {
  const nights = Math.round((new Date(end).getTime() - new Date(start).getTime()) / DAY);
  const startDate = new Date(Date.now() + offsetDays * DAY);
  startDate.setUTCHours(0, 0, 0, 0);
  return { startDate, endDate: new Date(startDate.getTime() + nights * DAY) };
}

// Three is enough to exercise every state: open, filling, and sold out.
const OFFSETS = [45, 90, 150];

async function main() {
  console.log("\nSeeding from lib/data/\n");

  for (const [index, t] of staticTrips.slice(0, 3).entries()) {
    // The public "from" price is the cheapest tier; that's what the cards
    // show and what a booking defaults to.
    const tierPrices = t.pricingTiers.map((tier) => tier.price);
    const pricePaise = rupeesToPaise(Math.min(...tierPrices));
    const advancePaise = t.advanceAmount ? rupeesToPaise(t.advanceAmount) : null;

    // "Balance in two installments" appears in their booking copy wherever
    // an advance is collected. No advance => paid in full at booking.
    const instalmentCount = advancePaise && advancePaise < pricePaise ? 2 : 0;

    const content = {
      introduction: json(doc(prose(t.introduction))),
      itinerary: json(t.itineraryDays.map((day) => ({
        dayNumber: day.dayNumber,
        dayLabel: day.dayLabel,
        date: day.date,
        title: day.title,
        body: doc(prose(day.description)),
      }))),
      inclusions: json(doc([bulletList(t.inclusions)])),
      exclusions: json(doc([bulletList(t.exclusions)])),
      thingsToKnow: json(doc([
        heading("The basics"),
        ...prose(t.thingsToKnow.basicInfo),
        heading("Joining from another city"),
        ...prose(t.thingsToKnow.fromOtherLocations),
        heading("Money to carry"),
        ...prose(t.thingsToKnow.money),
        heading("How to book"),
        ...prose(t.thingsToKnow.howToBook),
        heading("Why travel with DOT"),
        bulletList(t.whyTravelWithUs),
        heading("Who can join"),
        ...prose(t.whoCanJoin),
      ])),
      cancellationPolicy: json(doc(prose(t.cancellationPolicy))),
    };

    const shared = {
      title: t.title,
      tagline: t.tagline,
      destination: t.destination,
      category: t.category,
      cardImage: t.thumbnailImage,
      heroImage: t.heroImage,
      ...futureDates(t.startDate, t.endDate, OFFSETS[index]),
      durationLabel: t.duration,
      startingFrom: t.startingFrom,
      ageGroup: t.ageGroup,
      pricePaise,
      advancePaise,
      gstPercent: t.gstPercentage,
      instalmentCount,
      // Razorpay stays off until KYC clears. Bookings still work — they
      // record as REQUESTED and email both sides.
      razorpayEnabled: false,
      isFeatured: t.isFeatured,
      status: "PUBLISHED" as const,
      publishedAt: new Date(),
      ...content,
    };

    const trip = await prisma.trip.upsert({
      where: { slug: t.slug },
      // seatsBooked is deliberately absent from the update branch: once
      // this trip has real bookings, re-seeding must never reset the count.
      update: shared,
      create: {
        slug: t.slug,
        totalSeats: t.totalSlots,
        seatsBooked: t.bookedSlots,
        minParticipants: 1,
        ...shared,
      },
    });

    await prisma.tripPricingTier.deleteMany({ where: { tripId: trip.id } });
    await prisma.tripPricingTier.createMany({
      data: t.pricingTiers.map((tier, i) => ({
        tripId: trip.id,
        label: tier.label,
        description: tier.description,
        pricePaise: rupeesToPaise(tier.price),
        sortOrder: i,
      })),
    });

    console.log(
      `  ${t.slug.padEnd(38)} ${t.bookedSlots}/${t.totalSlots} seats · ` +
        `starts in ${OFFSETS[index]}d · ₹${(pricePaise / 100).toLocaleString("en-IN")}`,
    );
  }

  // ── Reviews ──
  // Seeded from the existing testimonials. isVerified stays false: nothing
  // here links to a real booking, and that badge has to mean something.
  for (const [i, r] of testimonials.entries()) {
    await prisma.review.upsert({
      where: { id: `00000000-0000-0000-0000-00000000000${i + 1}` },
      update: {},
      create: {
        id: `00000000-0000-0000-0000-00000000000${i + 1}`,
        authorName: r.name,
        authorAvatar: r.avatar,
        rating: 5,
        body: r.quote,
        tripTitleSnapshot: r.trip,
        isVerified: false,
        isPublished: true,
        sortOrder: i,
      },
    });
  }
  console.log(`\n  ${testimonials.length} reviews seeded`);

  const [tripCount, tierCount, reviewCount] = await Promise.all([
    prisma.trip.count(),
    prisma.tripPricingTier.count(),
    prisma.review.count(),
  ]);
  console.log(`\n  totals: ${tripCount} trips · ${tierCount} tiers · ${reviewCount} reviews\n`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("\n💥", e);
    await prisma.$disconnect();
    process.exit(1);
  });
