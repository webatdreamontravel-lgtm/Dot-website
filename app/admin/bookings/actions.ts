"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { recalcForSeats } from "@/lib/booking/pricing";
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { seatsCounted } from "@/lib/booking/seats";
import { notifyPaymentRecorded, notifyStatusChange } from "@/lib/booking/notify";
import { isValidPhone, toNationalDigits } from "@/lib/phone";
import {
  reminderSelect,
  sendBalanceReminder,
} from "@/lib/payments/balanceReminder";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Moves a trip's booked-seat count.
 *
 * A single UPDATE takes its own row lock, so this is safe against concurrent
 * bookings without an explicit SELECT FOR UPDATE. GREATEST guards the floor:
 * a double-cancel must never push the count negative and silently create
 * phantom capacity.
 */
async function shiftSeats(tx: Prisma.TransactionClient, tripId: string, delta: number) {
  if (delta === 0) return;
  await tx.$executeRaw`
    UPDATE trips
       SET seats_booked = GREATEST(seats_booked + ${delta}, 0),
           updated_at = now()
     WHERE id = ${tripId}::uuid`;
}

/** Capacity check for anything that takes seats back. */
async function assertCapacity(tx: Prisma.TransactionClient, tripId: string, needed: number) {
  if (needed <= 0) return;
  const [{ n }] = await tx.$queryRaw<{ n: number }[]>`
    SELECT trip_seats_available(${tripId}::uuid) AS n`;
  if (Number(n) < needed) {
    throw new Error(`Only ${Number(n)} seat(s) available on this trip.`);
  }
}

async function audit(
  tx: Prisma.TransactionClient,
  actorId: string,
  action: string,
  entityId: string,
  before: unknown,
  after: unknown,
) {
  await tx.auditLog.create({
    data: {
      actorProfileId: actorId,
      action,
      entity: "booking",
      entityId,
      before: before as Prisma.InputJsonValue,
      after: after as Prisma.InputJsonValue,
    },
  });
}

const money = z
  .string()
  .trim()
  .min(1, "Enter an amount")
  // Typed in rupees; stored in paise. Round at the boundary so a stray
  // "1200.005" can't put a fraction of a paisa in the database.
  .transform((v) => Math.round(Number(v.replace(/[^0-9.]/g, "")) * 100))
  .refine((p) => Number.isFinite(p) && p > 0, "Enter a valid amount");

const paymentSchema = z.object({
  bookingId: z.string().uuid(),
  method: z.enum(["CASH", "UPI_MANUAL", "BANK_TRANSFER", "RAZORPAY", "OTHER"]),
  amountPaise: money,
  externalReference: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

/**
 * Records money received outside the website — cash at a meetup, a UPI
 * transfer, a bank deposit.
 *
 * The payment row and the booking's running total are written in one
 * transaction because amountPaidPaise is a denormalised sum: if the two ever
 * disagree, every balance the team quotes is wrong and there's no way to
 * tell which number lied.
 */
export async function recordPayment(input: z.input<typeof paymentSchema>): Promise<ActionResult> {
  const admin = await requireAdmin();

  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the payment details." };
  }
  const data = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: data.bookingId },
        select: {
          id: true, status: true, totalPaise: true, amountPaidPaise: true,
          trip: { select: { id: true, slug: true } },
        },
      });
      if (!booking) throw new Error("Booking not found.");

      await tx.payment.create({
        data: {
          bookingId: booking.id,
          method: data.method,
          // Offline money is already in hand — there's no authorise step to
          // wait on, so it lands captured.
          status: "CAPTURED",
          amountPaise: data.amountPaise,
          recordedByProfileId: admin.id,
          externalReference: data.externalReference || null,
          notes: data.notes || null,
          capturedAt: new Date(),
        },
      });

      const paid = booking.amountPaidPaise + data.amountPaise;

      // A request that has been paid against is a confirmed booking — the
      // team shouldn't have to remember to flip the status by hand.
      const nextStatus =
        booking.status === "REQUESTED" || booking.status === "PENDING_PAYMENT"
          ? "CONFIRMED"
          : booking.status;

      await tx.booking.update({
        where: { id: booking.id },
        data: {
          amountPaidPaise: paid,
          status: nextStatus,
          ...(nextStatus === "CONFIRMED" && booking.status !== "CONFIRMED"
            ? { confirmedAt: new Date() }
            : {}),
        },
      });

      // PENDING_PAYMENT holds its seats via seat_holds rather than the
      // booked count, so confirming it now has to claim them properly.
      if (booking.status === "PENDING_PAYMENT" && nextStatus === "CONFIRMED") {
        const b = await tx.booking.findUniqueOrThrow({
          where: { id: booking.id },
          select: { seats: true },
        });
        await shiftSeats(tx, booking.trip.id, b.seats);
      }

      await audit(tx, admin.id, "payment.recorded", booking.id,
        { amountPaidPaise: booking.amountPaidPaise, status: booking.status },
        { amountPaidPaise: paid, status: nextStatus, method: data.method });

      return {
        slug: booking.trip.slug,
        // Whether this payment is what confirmed the booking decides which
        // email the customer gets — a confirmation, or a receipt.
        justConfirmed: nextStatus === "CONFIRMED" && booking.status !== "CONFIRMED",
      };
    });

    // Outside the transaction on purpose: a mail provider being down must
    // not roll back money the team has already taken in cash.
    await notifyPaymentRecorded({
      bookingId: data.bookingId,
      amountPaise: data.amountPaise,
      method: data.method,
      externalReference: data.externalReference || null,
      justConfirmed: result.justConfirmed,
    });

    revalidateBooking(result.slug);
    return { ok: true };
  } catch (e) {
    return fail(e, "Couldn't record that payment.");
  }
}

const statusSchema = z.object({
  bookingId: z.string().uuid(),
  status: z.enum([
    "PENDING_PAYMENT", "REQUESTED", "CONFIRMED",
    "CANCELLED", "REFUNDED", "PARTIALLY_REFUNDED", "EXPIRED",
  ]),
  reason: z.string().trim().max(300).optional().or(z.literal("")),
});

/**
 * Changes a booking's status, moving seats to match.
 *
 * Cancelling gives the seat back to the trip; un-cancelling takes one, and
 * has to check there's still one to take — a trip can fill up while a
 * booking sits cancelled.
 */
export async function updateBookingStatus(
  input: z.input<typeof statusSchema>,
): Promise<ActionResult> {
  const admin = await requireAdmin();

  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That status isn't valid." };
  const { bookingId, status, reason } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        select: { id: true, status: true, seats: true, trip: { select: { id: true, slug: true } } },
      });
      if (!booking) throw new Error("Booking not found.");
      // No change, no email. Re-saving the same status must not chase the
      // customer with a second copy of news they already had.
      if (booking.status === status) return { slug: booking.trip.slug, changed: false };

      const was = seatsCounted(booking.status);
      const now = seatsCounted(status);

      if (!was && now) {
        await assertCapacity(tx, booking.trip.id, booking.seats);
        await shiftSeats(tx, booking.trip.id, booking.seats);
      } else if (was && !now) {
        await shiftSeats(tx, booking.trip.id, -booking.seats);
      }

      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status,
          cancellationReason: status === "CANCELLED" ? reason || null : null,
          cancelledAt: status === "CANCELLED" ? new Date() : null,
          confirmedAt: status === "CONFIRMED" ? new Date() : undefined,
        },
      });

      await audit(tx, admin.id, "booking.status_changed", booking.id,
        { status: booking.status }, { status, reason: reason || null });

      return { slug: booking.trip.slug, changed: true };
    });

    if (result.changed) {
      await notifyStatusChange({ bookingId, status, reason: reason || null });
    }

    revalidateBooking(result.slug);
    return { ok: true };
  } catch (e) {
    return fail(e, "Couldn't update the booking.");
  }
}

const cancelSeatSchema = z.object({
  bookingId: z.string().uuid(),
  travellerId: z.string().uuid(),
});

/**
 * Cancels one traveller's seat.
 *
 * The traveller row is kept and stamped `cancelledAt` rather than deleted, so
 * the booking still shows who was originally going. Their seat goes back to
 * the trip and the booking is re-priced for the smaller party — using the unit
 * price frozen on the booking, so the people still going pay what they were
 * originally quoted.
 *
 * Cancelling the last active seat cancels the whole booking and takes seats to
 * zero, rather than leaving a booking that claims a seat with nobody on it.
 */
export async function cancelSeat(input: z.input<typeof cancelSeatSchema>): Promise<ActionResult> {
  const admin = await requireAdmin();

  const parsed = cancelSeatSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Couldn't identify that traveller." };
  const { bookingId, travellerId } = parsed.data;

  try {
    const slug = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        select: {
          id: true, status: true, seats: true,
          unitPricePaise: true, gstPercent: true, tcsPercent: true,
          subtotalPaise: true, totalPaise: true, amountPaidPaise: true,
          trip: { select: { id: true, slug: true } },
          travellers: { select: { id: true, fullName: true, cancelledAt: true } },
        },
      });
      if (!booking) throw new Error("Booking not found.");

      const traveller = booking.travellers.find((t) => t.id === travellerId);
      if (!traveller) throw new Error("That traveller isn't on this booking.");
      if (traveller.cancelledAt) throw new Error("That seat is already cancelled.");

      // Seats follow the people still going, so the count can never drift
      // from the list shown against it.
      const remaining = booking.travellers.filter(
        (t) => t.id !== travellerId && !t.cancelledAt,
      ).length;

      // A booking always has at least one traveller. Emptying it here would
      // mean seats = 0, which `bookings_seats_positive` rejects outright —
      // and a zero-seat live booking is meaningless anyway. Cancelling the
      // whole booking is a status change, so send them there.
      if (remaining === 0) {
        throw new Error(
          "This is the only traveller left. Cancel the whole booking from Status instead.",
        );
      }

      await tx.bookingTraveller.update({
        where: { id: travellerId },
        data: { cancelledAt: new Date() },
      });

      const priced = recalcForSeats(booking, remaining);

      if (seatsCounted(booking.status)) await shiftSeats(tx, booking.trip.id, -1);

      await tx.booking.update({
        where: { id: booking.id },
        data: {
          seats: priced.seats,
          subtotalPaise: priced.subtotalPaise,
          gstPaise: priced.gstPaise,
          tcsPaise: priced.tcsPaise,
          totalPaise: priced.totalPaise,
        },
      });

      await audit(tx, admin.id, "booking.seat_cancelled", booking.id,
        { seats: booking.seats, totalPaise: booking.totalPaise },
        { seats: priced.seats, totalPaise: priced.totalPaise, cancelled: traveller.fullName });

      return booking.trip.slug;
    });

    revalidateBooking(slug);
    return { ok: true };
  } catch (e) {
    return fail(e, "Couldn't cancel that seat.");
  }
}

const detailsSchema = z.object({
  bookingId: z.string().uuid(),
  source: z.enum(["WEB", "ADMIN_OFFLINE", "WHATSAPP", "FESTIVAL"]),
  internalNotes: z.string().trim().max(2000).optional().or(z.literal("")),
  travellers: z
    .array(
      z.object({
        id: z.string().uuid(),
        fullName: z.string().trim().min(2, "Name is required").max(120),
        // Optional here — the admin edits an existing traveller and may be
        // fixing only a name — but anything present is normalised, so an
        // edit can't reintroduce a "+91…" variant of a number we already hold.
        phone: z
          .string()
          .trim()
          .refine((v) => v === "" || isValidPhone(v), "Enter a 10-digit mobile number")
          .transform(toNationalDigits)
          .optional()
          .or(z.literal("")),
        email: z.string().trim().max(160).optional().or(z.literal("")),
      }),
    )
    .max(10),
});

/** Corrects the details on a booking — how it came in, notes, traveller info. */
export async function updateBookingDetails(
  input: z.input<typeof detailsSchema>,
): Promise<ActionResult> {
  const admin = await requireAdmin();

  const parsed = detailsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const { bookingId, source, internalNotes, travellers } = parsed.data;

  try {
    const slug = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        select: { id: true, source: true, trip: { select: { slug: true } } },
      });
      if (!booking) throw new Error("Booking not found.");

      await tx.booking.update({
        where: { id: booking.id },
        data: { source, internalNotes: internalNotes || null },
      });

      for (const t of travellers) {
        await tx.bookingTraveller.update({
          where: { id: t.id },
          // Scoped by booking id as well, so a tampered form can't rewrite a
          // traveller that belongs to somebody else's booking.
          data: { fullName: t.fullName, phone: t.phone || null, email: t.email || null },
        });
      }

      await audit(tx, admin.id, "booking.details_updated", booking.id,
        { source: booking.source }, { source, travellers: travellers.length });

      return booking.trip.slug;
    });

    revalidateBooking(slug);
    return { ok: true };
  } catch (e) {
    return fail(e, "Couldn't save those changes.");
  }
}

function revalidateBooking(tripSlug: string) {
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/trips");
  revalidatePath("/admin/customers");
  revalidatePath(`/trips/${tripSlug}`);
}

function fail(e: unknown, fallback: string): ActionResult {
  const message = e instanceof Error ? e.message : String(e);
  // Messages thrown deliberately above are safe and useful to show; anything
  // else is a database error the customer-facing team can't act on.
  const safe =
    /available|not found|isn't on this booking|already cancelled|only traveller left/i.test(message);
  if (!safe) console.error("[admin/bookings]", e);
  return { ok: false, error: safe ? message : fallback };
}

/**
 * Sends money back through Razorpay.
 *
 * Kept in this file rather than lib/payments so the admin screens have one
 * import for every booking action; the arithmetic and the API call live in
 * lib/payments/refunds.ts.
 *
 * Note what this does NOT do: mark the booking refunded. Razorpay confirms
 * refunds asynchronously, so `refunded_paise` is only written when the
 * refund.processed webhook arrives. Until then the admin shows the refund as
 * pending, which is the truth — the money has been asked for, not moved.
 */
const refundSchema = z.object({
  reference: z.string().trim().min(1),
  amountRupees: z.coerce.number().positive("Enter an amount greater than zero"),
  reason: z.string().trim().max(300).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function refundBooking(
  input: z.input<typeof refundSchema>,
): Promise<ActionResult> {
  const admin = await requireAdmin();

  const parsed = refundSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the amount and try again." };
  }
  const data = parsed.data;

  const booking = await prisma.booking.findUnique({
    where: { reference: data.reference },
    select: { id: true, trip: { select: { slug: true } } },
  });
  if (!booking) return { ok: false, error: "That booking no longer exists." };

  try {
    const { requestRefund } = await import("@/lib/payments/refunds");
    const result = await requestRefund({
      bookingId: booking.id,
      amountPaise: Math.round(data.amountRupees * 100),
      reason: data.reason || undefined,
      notes: data.notes || undefined,
      initiatedByProfileId: admin.id,
    });

    if (!result.ok) return { ok: false, error: result.error };

    await prisma.auditLog.create({
      data: {
        actorProfileId: admin.id,
        action: "refund.requested",
        entity: "booking",
        entityId: booking.id,
        after: { amountPaise: result.amountPaise, reason: data.reason || null },
      },
    });

    revalidatePath(`/admin/bookings/${data.reference}`);
    revalidatePath("/admin/bookings");
    revalidatePath(`/trips/${booking.trip.slug}`);
    return { ok: true };
  } catch (e) {
    return fail(e, "Couldn't start that refund.");
  }
}

/**
 * Sends a balance reminder now, from the booking screen.
 *
 * Exists because the automated schedule can't know that someone just rang to
 * say they'd pay, or that a trip lead wants a nudge sent before a WhatsApp
 * call. It sends the SAME email the cron would — one template, so a manual
 * nudge can never drift from the automated one.
 *
 * Deduped on the calendar date in its own namespace, which does two things:
 * a double-clicked button sends once, but a human can still nudge someone
 * today even if this morning's automated reminder already went out.
 */
export async function sendBalanceReminderNow(
  reference: string,
): Promise<ActionResult & { info?: string }> {
  const admin = await requireAdmin();

  const booking = await prisma.booking.findUnique({
    where: { reference },
    select: reminderSelect,
  });
  if (!booking) return { ok: false, error: "That booking no longer exists." };

  const today = new Date().toISOString().slice(0, 10);
  const result = await sendBalanceReminder(booking, {
    dedupeKey: `balance_reminder:manual:${booking.id}:${today}`,
  });

  if (!result.ok) return { ok: false, error: result.error };

  // A second click on the same day. The button already promises this won't
  // send twice, so it is the expected outcome and not an error — but it must
  // not report a send that didn't happen either.
  if (!result.sent && result.reason === "already-sent") {
    return { ok: true, info: "Already sent today — nothing sent again." };
  }

  if (!result.sent) {
    const why: Record<string, string> = {
      "no-balance": "Nothing to chase — this booking is fully paid.",
      "no-email": "No email address on this booking.",
      "not-active": "This booking isn't active, so there's no balance to chase.",
    };
    return { ok: false, error: why[result.reason] ?? "Nothing was sent." };
  }

  await prisma.auditLog.create({
    data: {
      actorProfileId: admin.id,
      action: "booking.reminder_sent",
      entity: "booking",
      entityId: booking.id,
      after: { to: result.to },
    },
  });

  revalidatePath(`/admin/bookings/${reference}`);
  return { ok: true, info: `Reminder sent to ${result.to}` };
}
