import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Read models for the public site.
 *
 * These are deliberately narrow: the Trip row carries admin-only fields
 * (internal notes, draft content, cost basis) that must never reach the
 * browser. Selecting explicitly means adding a sensitive column to the
 * schema can't accidentally leak it into a page payload.
 */

export type Availability = "OPEN" | "FAST_FILLING" | "FEW_SLOTS_LEFT" | "SOLD_OUT";

export type TripCardView = {
  slug: string;
  title: string;
  tagline: string | null;
  category: string | null;
  destination: string | null;
  cardImage: string | null;
  heroImage: string | null;
  startDate: string;
  endDate: string;
  durationLabel: string | null;
  ageGroup: string | null;
  availability: Availability;
  seatsTotal: number;
  seatsAvailable: number;
  showSeatsLeft: boolean;
  /** Rupees, already divided from paise. */
  fromPrice: number;
  comparePrice: number | null;
  offerLabel: string | null;
  gstPercent: number;
  tcsPercent: number;
  isFeatured: boolean;
};

export type MoodEntry = { label: string; value: number };

export type TripReview = {
  authorName: string;
  tripTitle: string | null;
  rating: number;
  body: string;
};

export type TripDetailView = TripCardView & {
  id: string;
  reviews: TripReview[];
  moodboard: MoodEntry[];
  startingFrom: string | null;
  advance: number | null;
  instalmentCount: number;
  razorpayEnabled: boolean;
  minParticipants: number;
  gallery: string[];
  pricingTiers: { label: string; description: string | null; price: number }[];
  introduction: unknown;
  itinerary: ItineraryDay[];
  inclusions: unknown;
  exclusions: unknown;
  thingsToKnow: unknown;
  cancellationPolicy: unknown;
};

export type ItineraryDay = {
  dayNumber: number;
  dayLabel: string;
  date: string;
  title: string;
  body: unknown;
  image?: string | null;
};

const paise = (n: number) => Math.round(n) / 100;

/**
 * The badge shown on cards. Derived, never stored — a stored copy would
 * drift the moment a booking or a cancellation lands.
 */
function availabilityOf(total: number, available: number): Availability {
  if (available <= 0) return "SOLD_OUT";
  const soldRatio = (total - available) / total;
  if (available <= 3) return "FEW_SLOTS_LEFT";
  if (soldRatio >= 0.6) return "FAST_FILLING";
  return "OPEN";
}

/**
 * seats_available comes from the SQL function so holds are accounted for
 * exactly the way reserve_seats() accounts for them. Computing it in JS
 * would mean two definitions of "available" that could disagree.
 */
type SeatRow = { id: string; seats_available: number };

async function seatsFor(tripIds: string[]): Promise<Map<string, number>> {
  if (tripIds.length === 0) return new Map();
  const rows = await prisma.$queryRaw<SeatRow[]>`
    SELECT id, trip_seats_available(id) AS seats_available
    FROM trips WHERE id = ANY(${tripIds}::uuid[])`;
  return new Map(rows.map((r) => [r.id, Number(r.seats_available)]));
}

const cardSelect = {
  id: true,
  slug: true,
  title: true,
  tagline: true,
  category: true,
  destination: true,
  cardImage: true,
  heroImage: true,
  startDate: true,
  endDate: true,
  durationLabel: true,
  ageGroup: true,
  totalSeats: true,
  showSeatsLeft: true,
  pricePaise: true,
  comparePricePaise: true,
  offerLabel: true,
  offerEndsAt: true,
  gstPercent: true,
  tcsPercent: true,
  isFeatured: true,
} as const;

type CardRow = {
  id: string; slug: string; title: string; tagline: string | null;
  category: string | null; destination: string | null;
  cardImage: string | null; heroImage: string | null;
  startDate: Date; endDate: Date; durationLabel: string | null;
  ageGroup: string | null; totalSeats: number; showSeatsLeft: boolean;
  pricePaise: number; comparePricePaise: number | null;
  offerLabel: string | null; offerEndsAt: Date | null; gstPercent: number;
  tcsPercent: number; isFeatured: boolean;
};

function toCardView(t: CardRow, seatsAvailable: number): TripCardView {
  // An expired offer must stop rendering as an offer, or the site keeps
  // advertising a discount that no longer applies.
  const offerLive = !t.offerEndsAt || t.offerEndsAt.getTime() > Date.now();

  return {
    slug: t.slug,
    title: t.title,
    tagline: t.tagline,
    category: t.category,
    destination: t.destination,
    cardImage: t.cardImage,
    heroImage: t.heroImage,
    startDate: t.startDate.toISOString(),
    endDate: t.endDate.toISOString(),
    durationLabel: t.durationLabel,
    ageGroup: t.ageGroup,
    availability: availabilityOf(t.totalSeats, seatsAvailable),
    seatsTotal: t.totalSeats,
    seatsAvailable,
    showSeatsLeft: t.showSeatsLeft,
    fromPrice: paise(t.pricePaise),
    comparePrice: offerLive && t.comparePricePaise ? paise(t.comparePricePaise) : null,
    offerLabel: offerLive ? t.offerLabel : null,
    gstPercent: t.gstPercent,
    tcsPercent: t.tcsPercent,
    isFeatured: t.isFeatured,
  };
}

/** Published, not-yet-departed trips, soonest first. */
export async function getUpcomingTrips(limit?: number): Promise<TripCardView[]> {
  const rows = await prisma.trip.findMany({
    where: {
      status: "PUBLISHED",
      deletedAt: null,
      endDate: { gte: new Date() },
    },
    orderBy: [{ isFeatured: "desc" }, { startDate: "asc" }],
    take: limit,
    select: cardSelect,
  });

  const seats = await seatsFor(rows.map((r) => r.id));
  return rows.map((r) => toCardView(r, seats.get(r.id) ?? 0));
}

export async function getFeaturedTrip(): Promise<TripCardView | null> {
  const all = await getUpcomingTrips();
  return all.find((t) => t.availability !== "SOLD_OUT") ?? all[0] ?? null;
}

export async function getTripBySlug(slug: string): Promise<TripDetailView | null> {
  return loadTripDetail({ slug, status: "PUBLISHED", deletedAt: null });
}

/**
 * Loads a trip regardless of status, for the admin draft preview.
 *
 * Callers MUST have gone through requireAdmin() — this deliberately ignores
 * the publish gate, which is the only thing keeping unfinished trips off the
 * public site.
 */
export async function getTripForPreview(id: string): Promise<TripDetailView | null> {
  return loadTripDetail({ id, deletedAt: null });
}

async function loadTripDetail(
  where: { slug?: string; id?: string; status?: "PUBLISHED"; deletedAt: null },
): Promise<TripDetailView | null> {
  const t = await prisma.trip.findFirst({
    where,
    select: {
      ...cardSelect,
      startingFrom: true,
      advancePaise: true,
      instalmentCount: true,
      razorpayEnabled: true,
      minParticipants: true,
      gallery: true,
      introduction: true,
      itinerary: true,
      inclusions: true,
      exclusions: true,
      thingsToKnow: true,
      moodboard: true,
      cancellationPolicy: true,
      pricingTiers: {
        orderBy: { sortOrder: "asc" },
        select: { label: true, description: true, pricePaise: true },
      },
      reviews: {
        where: { isPublished: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        take: 3,
        select: { authorName: true, tripTitleSnapshot: true, rating: true, body: true },
      },
    },
  });

  if (!t) return null;

  const seats = await seatsFor([t.id]);

  return {
    ...toCardView(t, seats.get(t.id) ?? 0),
    id: t.id,
    reviews: t.reviews.map((r) => ({
      authorName: r.authorName,
      tripTitle: r.tripTitleSnapshot,
      rating: r.rating,
      body: r.body,
    })),
    moodboard: Array.isArray(t.moodboard)
      ? (t.moodboard as MoodEntry[]).filter(
          (m) => m && typeof m.label === "string" && typeof m.value === "number",
        )
      : [],
    startingFrom: t.startingFrom,
    advance: t.advancePaise ? paise(t.advancePaise) : null,
    instalmentCount: t.instalmentCount,
    razorpayEnabled: t.razorpayEnabled,
    minParticipants: t.minParticipants,
    gallery: Array.isArray(t.gallery) ? (t.gallery as string[]) : [],
    pricingTiers: t.pricingTiers.map((p) => ({
      label: p.label,
      description: p.description,
      price: paise(p.pricePaise),
    })),
    introduction: t.introduction,
    itinerary: Array.isArray(t.itinerary) ? (t.itinerary as unknown as ItineraryDay[]) : [],
    inclusions: t.inclusions,
    exclusions: t.exclusions,
    thingsToKnow: t.thingsToKnow,
    cancellationPolicy: t.cancellationPolicy,
  };
}

/** Slugs for generateStaticParams / sitemap. */
export async function getPublishedTripSlugs(): Promise<string[]> {
  const rows = await prisma.trip.findMany({
    where: { status: "PUBLISHED", deletedAt: null },
    select: { slug: true },
  });
  return rows.map((r) => r.slug);
}
