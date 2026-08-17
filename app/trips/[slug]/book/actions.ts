"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionProfile } from "@/lib/auth";
import { buildReference, computePricing, MAX_SEATS_PER_BOOKING } from "@/lib/booking/pricing";
import { prisma } from "@/lib/prisma";

export type BookingResult =
  | { ok: true; reference: string }
  | { ok: false; error: string; code?: "SEATS_GONE" | "SIGNED_OUT" | "NOT_BOOKABLE" };

/**
 * Every traveller needs reachable contact details.
 *
 * The team runs the trip over WhatsApp and email, and a group of strangers
 * means the person who booked often can't answer for the others — so a
 * missing number is a real operational problem, not a blank field.
 */
const travellerSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the traveller's full name").max(120),
  phone: z
    .string()
    .trim()
    .min(1, "Phone number is required")
    // Deliberately loose on formatting and strict on substance: +91, spaces
    // and dashes are all fine, but there must be a real number in there.
    .refine((v) => {
      const digits = v.replace(/\D/g, "");
      return digits.length >= 10 && digits.length <= 15;
    }, "Enter a valid phone number"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address").max(160),
});

const bookingSchema = z.object({
  slug: z.string().trim().min(1),
  seats: z.coerce.number().int().min(1).max(MAX_SEATS_PER_BOOKING),
  travellers: z.array(travellerSchema).min(1).max(MAX_SEATS_PER_BOOKING),
  emergencyContactName: z.string().trim().max(120).optional().or(z.literal("")),
  emergencyContactPhone: z.string().trim().max(20).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

/**
 * Works out which seat function refused us, and why.
 *
 * reserve_seats() distinguishes its failure modes with a HINT, because both
 * "no seats" and "trip closed" raise SQLSTATE P0001. Prisma's error message
 * carries only the message text — the hint survives on the underlying pg
 * error, several `cause` levels down — so look for it there first and fall
 * back to the message wording.
 */
function seatErrorFrom(e: unknown): "SEATS_GONE" | "NOT_BOOKABLE" | null {
  const hints: string[] = [];
  const messages: string[] = [];

  let node: unknown = e;
  for (let depth = 0; node && depth < 6; depth++) {
    const obj = node as { hint?: unknown; message?: unknown; cause?: unknown };
    if (typeof obj.hint === "string") hints.push(obj.hint);
    if (typeof obj.message === "string") messages.push(obj.message);
    node = obj.cause;
  }

  const haystack = [...hints, ...messages].join(" | ");

  if (/INSUFFICIENT_SEATS|no seats available|seat\(s\) available/i.test(haystack)) {
    return "SEATS_GONE";
  }
  if (/TRIP_NOT_PUBLISHED|TRIP_NOT_FOUND|not open for booking|trip not found/i.test(haystack)) {
    return "NOT_BOOKABLE";
  }
  return null;
}

/**
 * Records a booking request.
 *
 * No money changes hands here — this is the path every trip uses while
 * Razorpay is off, so the booking lands as REQUESTED and the team collects
 * the advance themselves. Seats are counted immediately, because a request
 * the team has to honour is as good as a sold seat.
 *
 * The whole thing is one transaction wrapped around the tested seat
 * functions: reserve_seats() takes FOR UPDATE on the trip row, so any
 * concurrent booking for the same trip queues behind it, and either the
 * booking and the seat increment both happen or neither does.
 */
export async function createBookingRequest(
  input: z.input<typeof bookingSchema>,
): Promise<BookingResult> {
  const profile = await getSessionProfile();
  if (!profile) {
    return { ok: false, error: "Your session expired. Sign in again to finish.", code: "SIGNED_OUT" };
  }

  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details and try again." };
  }
  const data = parsed.data;

  // The form can't be trusted about how many travellers it sent.
  if (data.travellers.length !== data.seats) {
    return { ok: false, error: "Traveller details don't match the number of seats." };
  }

  const trip = await prisma.trip.findFirst({
    where: { slug: data.slug, status: "PUBLISHED", deletedAt: null, endDate: { gte: new Date() } },
    select: {
      id: true, slug: true, title: true, startDate: true,
      pricePaise: true, gstPercent: true, tcsPercent: true, advancePaise: true,
    },
  });

  if (!trip) {
    return { ok: false, error: "This trip is no longer open for booking.", code: "NOT_BOOKABLE" };
  }

  // Priced here, on the server, from the trip row — never from the form.
  const price = computePricing(trip, data.seats);

  try {
    const reference = await prisma.$transaction(async (tx) => {
      // Takes the trip row lock. Everything below is serialised per trip.
      const [{ reserve_seats: holdId }] = await tx.$queryRaw<{ reserve_seats: string }[]>`
        SELECT reserve_seats(${trip.id}::uuid, ${profile.id}::uuid, ${data.seats}::int, 15::int)`;

      // Safe to count inside the lock: no other booking for this trip can
      // commit until this transaction ends, so the sequence can't collide.
      const sequence = (await tx.booking.count({ where: { tripId: trip.id } })) + 1;
      const ref = buildReference(trip.slug, trip.startDate, sequence);

      const booking = await tx.booking.create({
        data: {
          reference: ref,
          tripId: trip.id,
          profileId: profile.id,
          status: "REQUESTED",
          source: "WEB",
          seats: data.seats,
          unitPricePaise: price.unitPricePaise,
          subtotalPaise: price.subtotalPaise,
          gstPercent: price.gstPercent,
          gstPaise: price.gstPaise,
          tcsPercent: price.tcsPercent,
          tcsPaise: price.tcsPaise,
          totalPaise: price.totalPaise,
          amountPaidPaise: 0,
          internalNotes: data.notes || null,
          travellers: {
            create: data.travellers.map((t, i) => ({
              fullName: t.fullName,
              phone: t.phone,
              email: t.email,
              // Emergency contact is asked once and kept against the lead
              // traveller — it's one contact for the party, not per person.
              emergencyContactName: i === 0 ? data.emergencyContactName || null : null,
              emergencyContactPhone: i === 0 ? data.emergencyContactPhone || null : null,
            })),
          },
        },
        select: { id: true, reference: true },
      });

      // Converts the hold into counted seats and links it to the booking.
      await tx.$executeRaw`SELECT confirm_seat_hold(${holdId}::uuid, ${booking.id}::uuid)`;

      // Learn who this customer actually is.
      //
      // Signing in with a one-time code creates a profile holding nothing but
      // an email address, so the admin booking list showed a dash where the
      // customer's name should be. Booking is the first moment we're told a
      // name and number, so keep them — but never overwrite details the
      // customer has already set.
      const lead = data.travellers[0];
      if (!profile.fullName || !profile.phone) {
        await tx.profile.update({
          where: { id: profile.id },
          data: {
            fullName: profile.fullName || lead.fullName,
            phone: profile.phone || lead.phone,
          },
        });
      }

      return booking.reference;
    });

    // The trip page shows seats left, and the admin list shows the count.
    revalidatePath(`/trips/${trip.slug}`);
    revalidatePath("/trips");
    revalidatePath("/admin/trips");

    return { ok: true, reference };
  } catch (e) {
    const code = seatErrorFrom(e);

    if (code === "SEATS_GONE") {
      return {
        ok: false,
        code: "SEATS_GONE",
        error: "Those seats just went. Reduce the number of travellers, or message us on WhatsApp.",
      };
    }
    if (code === "NOT_BOOKABLE") {
      return { ok: false, code: "NOT_BOOKABLE", error: "This trip is no longer open for booking." };
    }

    console.error("[booking] request failed", e);
    return { ok: false, error: "Something went wrong saving your booking. Nothing was charged — please try again." };
  }
}
