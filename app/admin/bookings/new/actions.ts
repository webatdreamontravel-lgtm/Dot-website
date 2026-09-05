"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import {computePricing, MAX_SEATS_PER_BOOKING } from "@/lib/booking/pricing";
import { prisma } from "@/lib/prisma";
import { searchCustomers } from "@/lib/queries/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidPhone, toNationalDigits } from "@/lib/phone";
import { nextBookingReference } from "@/lib/booking/reference";
import { creditBalance, creditBalances, redeemCredit } from "@/lib/credit/ledger";
import { amountToPaise } from "@/lib/money";

export type CustomerHit = {
  id: string;
  fullName: string | null;
  email: string;
  phone: string | null;
  city: string | null;
  bookings: number;
  /** Travel credit they can spend. Shown on the row so it can't be missed. */
  creditPaise: number;
};

/** Typeahead behind "search for the customer". */
export async function findCustomers(query: string): Promise<CustomerHit[]> {
  await requireAdmin();
  const rows = await searchCustomers(query);
  // One grouped query for the page of results rather than one per row.
  const balances = await creditBalances(rows.map((r) => r.id));
  return rows.map((r) => ({
    id: r.id,
    fullName: r.fullName,
    email: r.email,
    phone: r.phone,
    city: r.city,
    bookings: r._count.bookings,
    creditPaise: balances.get(r.id) ?? 0,
  }));
}

/** What one customer can spend, for the form to re-check after selection. */
export async function getCreditBalance(profileId: string): Promise<number> {
  await requireAdmin();
  return creditBalance(profileId);
}

export type CreateResult =
  | { ok: true; reference: string }
  | { ok: false; error: string; field?: string };

const travellerSchema = z.object({
  fullName: z.string().trim().min(2, "Traveller name is required").max(120),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  email: z.string().trim().max(160).optional().or(z.literal("")),
});

const schema = z.object({
  tripId: z.string().uuid("Choose a trip"),
  // Exactly one of these: an existing customer, or the details to make one.
  profileId: z.string().uuid().optional().or(z.literal("")),
  newCustomer: z
    .object({
      fullName: z.string().trim().min(2, "Customer name is required").max(120),
      email: z.string().trim().toLowerCase().email("Enter a valid email").max(160),
      phone: z
        .string()
        .trim()
        .min(1, "Phone number is required")
        .refine(isValidPhone, "Enter a 10-digit mobile number")
        .transform(toNationalDigits),
      city: z.string().trim().max(80).optional().or(z.literal("")),
      state: z.string().trim().max(80).optional().or(z.literal("")),
      gender: z.enum(["MALE", "FEMALE"]).optional().or(z.literal("")),
    })
    .optional(),
  seats: z.coerce.number().int().min(1).max(MAX_SEATS_PER_BOOKING),
  travellers: z.array(travellerSchema).min(1).max(MAX_SEATS_PER_BOOKING),
  source: z.enum(["ADMIN_OFFLINE", "WHATSAPP", "FESTIVAL", "WEB"]),
  status: z.enum(["REQUESTED", "CONFIRMED"]),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  // Optional money taken at the same moment — a festival stall booking is
  // usually paid on the spot.
  paymentAmount: z.string().trim().optional().or(z.literal("")),
  /**
   * CREDIT means the amount above comes out of the customer's travel credit
   * rather than their pocket. It is a method like any other, so the booking's
   * paid total and balance need no knowledge of credit at all.
   */
  paymentMethod: z.enum(["CASH", "UPI_MANUAL", "BANK_TRANSFER", "RAZORPAY", "CREDIT", "OTHER"]),
  paymentReference: z.string().trim().max(120).optional().or(z.literal("")),
});

/**
 * Books a seat on someone's behalf.
 *
 * Runs the same seat machinery as a customer booking — reserve_seats() takes
 * the trip row lock, so an admin entering a booking at a stall can't oversell
 * against someone booking online at the same moment.
 */
export async function createBookingForCustomer(
  input: z.input<typeof schema>,
): Promise<CreateResult> {
  const admin = await requireAdmin();

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: issue?.message ?? "Check the details and try again.",
      field: String(issue?.path?.join(".") ?? ""),
    };
  }
  const d = parsed.data;

  if (d.travellers.length !== d.seats) {
    return { ok: false, error: "Traveller details don't match the number of seats." };
  }
  if (!d.profileId && !d.newCustomer) {
    return { ok: false, error: "Pick a customer, or fill in their details." };
  }

  const trip = await prisma.trip.findFirst({
    where: { id: d.tripId, deletedAt: null },
    select: {
      id: true, slug: true, startDate: true,
      pricePaise: true, gstPercent: true, tcsPercent: true, advancePaise: true, status: true,
    },
  });
  if (!trip) return { ok: false, error: "That trip no longer exists." };

  // Resolve the customer before touching seats — creating an auth user is the
  // step most likely to fail, and doing it inside the seat lock would hold
  // the trip row while Supabase's API is called.
  let profileId: string;
  try {
    profileId = d.profileId
      ? d.profileId
      : await provisionCustomer(d.newCustomer!);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message, field: "newCustomer.email" };
  }

  const price = computePricing(trip, d.seats);

  try {
    const reference = await prisma.$transaction(async (tx) => {
      const [{ reserve_seats: holdId }] = await tx.$queryRaw<{ reserve_seats: string }[]>`
        SELECT reserve_seats(${trip.id}::uuid, ${profileId}::uuid, ${d.seats}::int, 15::int)`;

      // From the highest existing reference, not a row count — a gap in the
      // sequence would collide with a reference already in use.
      const ref = await nextBookingReference(tx, trip);

      const booking = await tx.booking.create({
        data: {
          reference: ref,
          tripId: trip.id,
          profileId,
          status: d.status,
          source: d.source,
          seats: d.seats,
          unitPricePaise: price.unitPricePaise,
          subtotalPaise: price.subtotalPaise,
          gstPercent: price.gstPercent,
          gstPaise: price.gstPaise,
          tcsPercent: price.tcsPercent,
          tcsPaise: price.tcsPaise,
          totalPaise: price.totalPaise,
          amountPaidPaise: 0,
          internalNotes: d.notes || null,
          confirmedAt: d.status === "CONFIRMED" ? new Date() : null,
          travellers: {
            create: d.travellers.map((t) => ({
              fullName: t.fullName,
              phone: t.phone || null,
              email: t.email || null,
            })),
          },
        },
        select: { id: true, reference: true },
      });

      await tx.$executeRaw`SELECT confirm_seat_hold(${holdId}::uuid, ${booking.id}::uuid)`;

      /**
       * Money taken at the same time — cash, and/or travel credit.
       *
       * Credit is written as a Payment like any other method, so everything
       * downstream (paid total, balance, instalments, reminders, reports)
       * works on it without knowing credit exists. The ledger entry is the
       * only credit-specific thing here, and it is in the same transaction
       * as the payment so the two can never disagree.
       */
      const paidPaise = toPaise(d.paymentAmount);
      const byCredit = d.paymentMethod === "CREDIT";

      if (paidPaise > 0) {
        // Credit spends from the ledger first. Throws with a readable message
        // if the balance is short, and takes a row lock so two admins
        // spending the same credit serialise rather than both succeeding.
        if (byCredit) {
          await redeemCredit(tx, {
            profileId,
            amountPaise: paidPaise,
            appliedBookingId: booking.id,
            createdByProfileId: admin.id,
            note: `Applied to ${ref}`,
          });
        }

        await tx.payment.create({
          data: {
            bookingId: booking.id,
            method: d.paymentMethod,
            status: "CAPTURED",
            amountPaise: paidPaise,
            recordedByProfileId: admin.id,
            externalReference: byCredit ? null : d.paymentReference || null,
            notes: byCredit ? "Travel credit" : null,
            capturedAt: new Date(),
          },
        });
      }

      if (paidPaise > 0) {
        await tx.booking.update({
          where: { id: booking.id },
          data: {
            amountPaidPaise: paidPaise,
            status: "CONFIRMED",
            confirmedAt: new Date(),
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorProfileId: admin.id,
          action: "booking.created_by_admin",
          entity: "booking",
          entityId: booking.id,
          after: {
            reference: ref, seats: d.seats, source: d.source, status: d.status,
            ...(byCredit && paidPaise > 0 ? { creditAppliedPaise: paidPaise } : {}),
          },
        },
      });

      return booking.reference;
    });

    revalidatePath("/admin/bookings");
    revalidatePath("/admin/trips");
    revalidatePath("/admin/customers");
    revalidatePath(`/trips/${trip.slug}`);

    return { ok: true, reference };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (/INSUFFICIENT_SEATS|no seats available|seat\(s\) available/i.test(message)) {
      return { ok: false, error: "Not enough seats left on that trip." };
    }
    if (/TRIP_NOT_PUBLISHED/i.test(message)) {
      return { ok: false, error: "That trip isn't published, so seats can't be reserved." };
    }
    // The ledger's own message already names the available figure.
    if (/travel credit is available|CREDIT_INSUFFICIENT/i.test(message)) {
      return { ok: false, error: message, field: "paymentAmount" };
    }
    console.error("[admin/bookings/new]", e);
    return { ok: false, error: "Couldn't create the booking." };
  }
}

/**
 * Makes an account for someone who has never used the site.
 *
 * A booking needs an owner, and profiles.id is foreign-keyed to auth.users —
 * so a Supabase user has to exist first. It's created with no password and
 * unverified, which is exactly what makes it claimable later: when the real
 * person signs up with this address, the signup flow sets their password and
 * emails them a code, and this booking is already waiting for them.
 */
async function provisionCustomer(input: {
  fullName: string;
  email: string;
  phone: string;
  city?: string;
  state?: string;
  gender?: string;
}) {
  const existing = await prisma.profile.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (existing) {
    // Reuse rather than refuse — the admin searched by name and missed them.
    return existing.id;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email: input.email,
    email_confirm: false,
    user_metadata: { full_name: input.fullName, phone: input.phone },
  });

  if (error || !data.user) {
    throw new Error(
      /already/i.test(error?.message ?? "")
        ? "An account with that email already exists — search for them instead."
        : "Couldn't create that customer. Check the email address.",
    );
  }

  // The trigger writes id/email/full_name; the rest is ours to fill in.
  await prisma.profile
    .update({
      where: { id: data.user.id },
      data: {
        fullName: input.fullName,
        phone: input.phone,
        city: input.city || null,
        state: input.state || null,
        gender: (input.gender || null) as "MALE" | "FEMALE" | null,
      },
    })
    .catch((e) => console.error("[admin] provision profile update failed", e));

  return data.user.id;
}

// Shared with every other money field, so a hand-crafted request is parsed
// exactly the way the form's own keystroke filter would have parsed it.
const toPaise = amountToPaise;
