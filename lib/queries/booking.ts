import "server-only";

import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Read models for the booking flow.
 *
 * Separate from queries/trips.ts because the booking screens need raw paise
 * and the trip id, where the public page deliberately exposes only rounded
 * rupees. Mixing the two would mean the marketing pages start carrying the
 * fields the checkout needs.
 */

export type BookableTrip = {
  id: string;
  slug: string;
  title: string;
  batchName: string | null;
  startDate: Date;
  endDate: Date;
  durationLabel: string | null;
  startingFrom: string | null;
  heroImage: string | null;
  cardImage: string | null;
  totalSeats: number;
  seatsAvailable: number;
  pricePaise: number;
  gstPercent: number;
  tcsPercent: number;
  advancePaise: number | null;
  razorpayEnabled: boolean;
};

/**
 * The trip a booking is being made against.
 *
 * Returns null for anything not currently bookable — draft, archived, soft
 * deleted, or already departed — so the booking route can 404 rather than
 * quietly taking a request for a trip that has left.
 */
export async function getBookableTrip(slug: string): Promise<BookableTrip | null> {
  const trip = await prisma.trip.findFirst({
    where: {
      slug,
      status: "PUBLISHED",
      isActive: true,
      deletedAt: null,
      endDate: { gte: new Date() },
    },
    select: {
      id: true, slug: true, title: true, batchName: true,
      startDate: true, endDate: true, durationLabel: true, startingFrom: true,
      heroImage: true, cardImage: true,
      totalSeats: true, pricePaise: true, gstPercent: true, tcsPercent: true,
      advancePaise: true, razorpayEnabled: true,
    },
  });

  if (!trip) return null;

  // Live availability counts unexpired holds as taken, so two people can't
  // both be told there's one seat left.
  const [{ n }] = await prisma.$queryRaw<{ n: number }[]>`
    SELECT trip_seats_available(${trip.id}::uuid) AS n`;

  return { ...trip, seatsAvailable: Number(n) };
}

/** One booking, for its confirmation page and the customer's own history. */
export async function getBookingForCustomer(reference: string, profileId: string) {
  return prisma.booking.findFirst({
    // Scoped by profile as well as reference: the reference is guessable
    // enough that it must never be the only thing standing between one
    // customer and another's booking.
    where: { reference, profileId },
    select: {
      id: true, reference: true, status: true, seats: true,
      unitPricePaise: true, subtotalPaise: true,
      gstPercent: true, gstPaise: true, tcsPercent: true, tcsPaise: true,
      totalPaise: true, amountPaidPaise: true, refundedPaise: true, createdAt: true,
      trip: {
        select: {
          slug: true, title: true, batchName: true, startDate: true, endDate: true,
          durationLabel: true, startingFrom: true, cardImage: true, advancePaise: true,
          // The customer's own page offers to settle the balance, which is
          // only possible on a trip that still takes payment online.
          razorpayEnabled: true,
        },
      },
      travellers: {
        // Cancelled travellers are KEPT and shown, not filtered out. Someone
        // who booked for three and dropped one needs to see which one went —
        // silently rendering two names beside a total that changed is how a
        // repricing looks like a mistake.
        orderBy: { createdAt: "asc" },
        select: {
          fullName: true, phone: true, email: true, cancelledAt: true,
          emergencyContactName: true, emergencyContactPhone: true,
        },
      },
      /**
       * Enough to show the customer HOW they paid, not just how much.
       *
       * Someone reconciling ₹4,200 against their bank statement finds ₹1,500
       * there and nothing else, because the other ₹2,700 was cash handed
       * over at a stall. The total alone cannot explain that.
       */
      payments: {
        where: { status: "CAPTURED" },
        orderBy: { capturedAt: "asc" },
        select: {
          status: true,
          method: true,
          amountPaise: true,
          convenienceFeePaise: true,
          capturedAt: true,
          createdAt: true,
        },
      },
      /**
       * PROCESSED only, to match refundedPaise.
       *
       * A PENDING Razorpay refund has not left our account, so listing it
       * would show the customer money they cannot yet look for — and the
       * lines would not add up to the total beside them.
       */
      refunds: {
        where: { status: "PROCESSED" },
        orderBy: { processedAt: "asc" },
        select: { method: true, amountPaise: true, processedAt: true, createdAt: true },
      },
    },
  });
}

/**
 * Every booking this customer has made, split into trips still to come and
 * trips already over.
 *
 * The split happens here rather than in the page because reading the clock
 * during a component render is impure — it belongs in the data layer.
 */
export async function getBookingsForCustomer(profileId: string) {
  const rows = await listBookings(profileId);
  const now = Date.now();

  return {
    all: rows,
    upcoming: rows.filter((b) => b.trip.endDate.getTime() >= now),
    past: rows.filter((b) => b.trip.endDate.getTime() < now),
  };
}

function listBookings(profileId: string) {
  return prisma.booking.findMany({
    where: { profileId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, reference: true, status: true, seats: true,
      totalPaise: true, amountPaidPaise: true, refundedPaise: true, createdAt: true,
      trip: {
        select: {
          slug: true, title: true, batchName: true,
          startDate: true, endDate: true, cardImage: true,
        },
      },
    },
  });
}

/** How many bookings a customer sees per page. */
export const BOOKINGS_PER_PAGE = 8;

export type CustomerBookingFilters = {
  q?: string;
  /** "upcoming" | "past" | "owing" | a BookingStatus | undefined for all. */
  view?: string;
  page?: string;
};

/**
 * The customer's own bookings, filtered and paged.
 *
 * Separate from getBookingsForCustomer, which loads everything for the
 * detail views. Someone with three bookings never needs this; someone who
 * has travelled with DOT for two years and has twenty does, and paging in
 * the database rather than the browser is what keeps that page the same
 * speed on their twentieth trip as their first.
 */
export async function getCustomerBookings(
  profileId: string,
  filters: CustomerBookingFilters = {},
) {
  const now = new Date();

  const where: Prisma.BookingWhereInput = { profileId };

  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { reference: { contains: q, mode: "insensitive" } },
      { trip: { title: { contains: q, mode: "insensitive" } } },
      { trip: { batchName: { contains: q, mode: "insensitive" } } },
      { trip: { destination: { contains: q, mode: "insensitive" } } },
    ];
  }

  switch (filters.view) {
    case "upcoming":
      where.trip = { ...(where.trip as object), endDate: { gte: now } };
      break;
    case "past":
      where.trip = { ...(where.trip as object), endDate: { lt: now } };
      break;
    case "owing":
      // Bookings that are actually going and still owe something. Prisma
      // can't compare two columns, so the balance is expressed as a raw
      // field reference rather than fetched and filtered in memory.
      where.status = { in: ["CONFIRMED", "REQUESTED"] };
      where.amountPaidPaise = { lt: prisma.booking.fields.totalPaise };
      break;
    default:
      break;
  }

  const total = await prisma.booking.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / BOOKINGS_PER_PAGE));
  const page = Math.min(Math.max(1, Number(filters.page) || 1), pageCount);

  const rows = await prisma.booking.findMany({
    where,
    // Soonest departure first for trips still to come; the ordering reads as
    // "what's next" rather than "what did I book most recently".
    orderBy: [{ trip: { startDate: "asc" } }, { createdAt: "desc" }],
    skip: (page - 1) * BOOKINGS_PER_PAGE,
    take: BOOKINGS_PER_PAGE,
    select: {
      id: true, reference: true, status: true, seats: true,
      totalPaise: true, amountPaidPaise: true, refundedPaise: true, createdAt: true,
      trip: {
        select: {
          slug: true, title: true, batchName: true, destination: true,
          startDate: true, endDate: true, cardImage: true, razorpayEnabled: true,
        },
      },
    },
  });

  return {
    // `departed` is decided here, against the same `now` the filters used.
    // Reading the clock inside a component is impure, and would let the
    // first card in a list be judged against a different instant than the
    // last — a trip ending at midnight could render as both past and
    // upcoming in one view.
    rows: rows.map((b) => ({ ...b, departed: b.trip.endDate.getTime() < now.getTime() })),
    total,
    page,
    pageCount,
    perPage: BOOKINGS_PER_PAGE,
  };
}

/** Headline numbers for the top of the account page. */
export async function getCustomerSummary(profileId: string) {
  const now = new Date();
  const [upcoming, owing] = await Promise.all([
    prisma.booking.count({
      where: {
        profileId,
        status: { in: ["CONFIRMED", "REQUESTED"] },
        trip: { endDate: { gte: now } },
      },
    }),
    prisma.booking.findMany({
      where: {
        profileId,
        status: { in: ["CONFIRMED", "REQUESTED"] },
        trip: { endDate: { gte: now } },
      },
      select: { totalPaise: true, amountPaidPaise: true },
    }),
  ]);

  return {
    upcomingCount: upcoming,
    outstandingPaise: owing.reduce(
      (n, b) => n + Math.max(b.totalPaise - b.amountPaidPaise, 0),
      0,
    ),
  };
}
