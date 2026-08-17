import "server-only";

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
      totalPaise: true, amountPaidPaise: true, createdAt: true,
      trip: {
        select: {
          slug: true, title: true, batchName: true, startDate: true, endDate: true,
          durationLabel: true, startingFrom: true, cardImage: true, advancePaise: true,
        },
      },
      travellers: {
        select: {
          fullName: true, phone: true, email: true,
          emergencyContactName: true, emergencyContactPhone: true,
        },
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
      totalPaise: true, amountPaidPaise: true, createdAt: true,
      trip: {
        select: {
          slug: true, title: true, batchName: true,
          startDate: true, endDate: true, cardImage: true,
        },
      },
    },
  });
}
