import "server-only";

import { prisma } from "@/lib/prisma";
import {
  buildReference,
  computeConvenienceFee,
  computePricing,
  MAX_SEATS_PER_BOOKING,
} from "@/lib/booking/pricing";
import { currentFeeRateBp } from "@/lib/payments/convenienceFee";
import { razorpay } from "@/lib/payments/client";

/** Minutes a seat is held while the customer is inside Razorpay's checkout. */
export const HOLD_MINUTES = 15;

export type TravellerInput = {
  fullName: string;
  phone: string;
  email: string;
};

/**
 * How much of the trip the customer wants to pay now.
 *
 * The advance is a floor, not a ceiling — someone who would rather settle
 * the whole thing today shouldn't be forced into a second payment later, and
 * a trip that is paid in full is one fewer balance for the team to chase.
 *
 * Only ever an enum across the wire. The amount itself is derived from the
 * trip row on the server; a client that could name its own figure could name
 * ₹1.
 */
export type PayMode = "ADVANCE" | "FULL";

export type OrderResult =
  | {
      ok: true;
      orderId: string;
      /** GROSS — what Razorpay will charge. Booking amount plus the fee. */
      amountPaise: number;
      /** The part that counts toward the trip. */
      bookingAmountPaise: number;
      /** Zero when the fee is switched off. */
      convenienceFeePaise: number;
      convenienceFeeRateBp: number;
      currency: string;
      reference: string;
      bookingId: string;
      /** Whether this order covers the advance only or the whole trip. */
      kind: "ADVANCE" | "FULL";
      holdExpiresAt: Date;
    }
  | { ok: false; error: string; code?: "SEATS_GONE" | "NOT_BOOKABLE" | "NOT_ENABLED" };

/**
 * Opens a checkout: holds the seats, creates the booking, and asks Razorpay
 * for an order to pay against.
 *
 * ── Why this is three steps and not one transaction ──
 *
 * Creating the Razorpay order is an HTTP call to a third party. Doing it
 * inside the transaction would mean holding the trip's row lock — taken by
 * reserve_seats() and blocking every other booking for that trip — for the
 * whole round trip to Razorpay. One slow response from them would serialise
 * the entire trip behind it, and an outage would hold locks until the
 * statement timeout fired.
 *
 * So the lock is taken and released first, and the order is created outside
 * it. The cost is a window where a booking exists with no order: if the
 * Razorpay call fails there, the booking stays PENDING_PAYMENT with a live
 * hold and no way to pay. That resolves itself — the hold lapses after
 * HOLD_MINUTES and release_expired_holds() returns the seats. A stuck lock
 * would not resolve itself, which is why this is the trade taken.
 */
export async function createPaymentOrder(input: {
  slug: string;
  profileId: string;
  seats: number;
  /** Defaults to ADVANCE when the trip has one, since that is the lower bar. */
  payMode?: PayMode;
  travellers: TravellerInput[];
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  notes?: string;
}): Promise<OrderResult> {
  const { slug, profileId, seats, travellers } = input;

  if (seats < 1 || seats > MAX_SEATS_PER_BOOKING || travellers.length !== seats) {
    return { ok: false, error: "Traveller details don't match the number of seats." };
  }

  const trip = await prisma.trip.findFirst({
    where: { slug, status: "PUBLISHED", isActive: true, deletedAt: null, endDate: { gte: new Date() } },
    select: {
      id: true, slug: true, title: true, startDate: true, razorpayEnabled: true,
      pricePaise: true, gstPercent: true, tcsPercent: true, advancePaise: true,
    },
  });

  if (!trip) return { ok: false, error: "This trip is no longer open for booking.", code: "NOT_BOOKABLE" };
  if (!trip.razorpayEnabled) {
    return { ok: false, error: "Online payment isn't enabled for this trip.", code: "NOT_ENABLED" };
  }

  // Priced from the trip row, never from the client.
  const price = computePricing(trip, seats);
  // A trip with no advance can only be paid in full, whatever was asked for.
  const canPayAdvance = price.advanceDuePaise > 0 && price.balancePaise > 0;
  const kind: PayMode = canPayAdvance && input.payMode !== "FULL" ? "ADVANCE" : "FULL";
  const bookingAmountPaise = kind === "ADVANCE" ? price.advanceDuePaise : price.totalPaise;

  // The gateway's cut, on the amount being charged now. Read fresh each time
  // rather than cached, so a rate change takes effect on the next checkout.
  const rateBp = await currentFeeRateBp();
  const fee = computeConvenienceFee(bookingAmountPaise, rateBp);
  const amountPaise = fee.grossPaise;

  // ── Reuse before creating ────────────────────────────────────────────
  // A customer who abandons checkout and comes back must land on the SAME
  // booking. Creating a second one would take a second hold, so one person
  // clicking Pay twice would occupy two seats and only ever pay for one.
  //
  // Deliberately NOT filtered by seat count: a booking for a different
  // number of seats still holds seats, and has to be dealt with rather than
  // ignored. See the two branches below.
  const existing = await prisma.booking.findFirst({
    where: {
      profileId,
      tripId: trip.id,
      status: "PENDING_PAYMENT",
      holdExpiresAt: { gt: new Date() },
      pendingHoldId: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, reference: true, seats: true, totalPaise: true,
      holdExpiresAt: true, pendingHoldId: true,
      payments: {
        where: { status: "CREATED", razorpayOrderId: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true, razorpayOrderId: true, amountPaise: true,
          convenienceFeePaise: true, convenienceFeeRateBp: true,
        },
      },
    },
  });

  // ── Identical order: hand back the one they already have ──
  // Matched on the amount as well as the seat count, so switching from
  // advance to full payment supersedes rather than silently reusing an order
  // for the wrong figure.
  const reusable =
    existing?.payments[0]?.razorpayOrderId &&
    existing.seats === seats &&
    existing.payments[0].amountPaise === amountPaise
      ? { booking: existing, orderId: existing.payments[0].razorpayOrderId }
      : null;

  if (reusable) {
    // Give them a full window again. Without this, someone who opens
    // checkout at minute 14 of their own hold gets sixty seconds to find
    // their card — and the failure looks like our bug, not their delay.
    // Only ever extends: a retry can't shorten an existing hold.
    const holdExpiresAt = new Date(Date.now() + HOLD_MINUTES * 60_000);
    await prisma.$transaction([
      prisma.$executeRaw`
        UPDATE seat_holds SET expires_at = ${holdExpiresAt}
         WHERE id = ${reusable.booking.pendingHoldId}::uuid
           AND released_at IS NULL AND booking_id IS NULL
           AND expires_at < ${holdExpiresAt}`,
      prisma.booking.update({
        where: { id: reusable.booking.id },
        data: { holdExpiresAt },
      }),
    ]);

    return {
      ok: true,
      orderId: reusable.orderId,
      amountPaise: reusable.booking.payments[0].amountPaise,
      bookingAmountPaise:
        reusable.booking.payments[0].amountPaise -
        reusable.booking.payments[0].convenienceFeePaise,
      convenienceFeePaise: reusable.booking.payments[0].convenienceFeePaise,
      convenienceFeeRateBp: reusable.booking.payments[0].convenienceFeeRateBp ?? 0,
      currency: "INR",
      reference: reusable.booking.reference,
      bookingId: reusable.booking.id,
      kind,
      holdExpiresAt,
    };
  }

  // ── Different party size: the old hold must go before a new one is taken ──
  // Otherwise going from 1 seat to 2 leaves the first hold live and the
  // customer silently occupies three seats while able to pay for two.
  // Released inside the same transaction as the new reservation, so there
  // is never a moment where both are held — or neither.
  const supersede = existing && !reusable ? existing : null;

  // ── 1. Hold the seats and create the booking ─────────────────────────
  let created: { id: string; reference: string; holdExpiresAt: Date };
  try {
    created = await prisma.$transaction(async (tx) => {
      if (supersede) {
        await tx.$executeRaw`
          UPDATE seat_holds SET released_at = now()
           WHERE id = ${supersede.pendingHoldId}::uuid
             AND released_at IS NULL AND booking_id IS NULL`;
        await tx.booking.update({
          where: { id: supersede.id },
          data: {
            status: "EXPIRED",
            pendingHoldId: null,
            holdExpiresAt: null,
            internalNotes:
              supersede.seats !== seats
                ? `Superseded — traveller count changed from ${supersede.seats} to ${seats}.`
                : `Superseded — switched to paying ${kind === "FULL" ? "in full" : "the advance"}.`,
          },
        });
        // The Razorpay order behind it can never be paid now. Marked so the
        // admin sees why, and so an unpaid order isn't mistaken for one
        // still in flight.
        if (supersede.payments[0]) {
          await tx.payment.update({
            where: { id: supersede.payments[0].id },
            data: { status: "FAILED", failureReason: "Superseded by a new order" },
          });
        }
      }

      const [{ reserve_seats: holdId }] = await tx.$queryRaw<{ reserve_seats: string }[]>`
        SELECT reserve_seats(${trip.id}::uuid, ${profileId}::uuid, ${seats}::int, ${HOLD_MINUTES}::int)`;

      const sequence = (await tx.booking.count({ where: { tripId: trip.id } })) + 1;
      const reference = buildReference(trip.slug, trip.startDate, sequence);
      const holdExpiresAt = new Date(Date.now() + HOLD_MINUTES * 60_000);

      const booking = await tx.booking.create({
        data: {
          reference,
          tripId: trip.id,
          profileId,
          // Seats are held, not counted. confirm_seat_hold() at settlement
          // is what actually increments trips.seats_booked.
          status: "PENDING_PAYMENT",
          source: "WEB",
          seats,
          unitPricePaise: price.unitPricePaise,
          subtotalPaise: price.subtotalPaise,
          gstPercent: price.gstPercent,
          gstPaise: price.gstPaise,
          tcsPercent: price.tcsPercent,
          tcsPaise: price.tcsPaise,
          totalPaise: price.totalPaise,
          amountPaidPaise: 0,
          holdExpiresAt,
          pendingHoldId: holdId,
          internalNotes: input.notes || null,
          travellers: {
            create: travellers.map((t, i) => ({
              fullName: t.fullName,
              phone: t.phone,
              email: t.email,
              emergencyContactName: i === 0 ? input.emergencyContactName || null : null,
              emergencyContactPhone: i === 0 ? input.emergencyContactPhone || null : null,
            })),
          },
        },
        select: { id: true, reference: true },
      });

      // The payment schedule, snapshot onto the booking. Only when an advance
      // is actually being paid — someone settling in full has no schedule,
      // and a single instalment row would just be noise.
      if (kind === "ADVANCE") {
        await tx.bookingInstalment.createMany({
          data: [
            {
              bookingId: booking.id,
              sequence: 1,
              label: "Advance",
              amountPaise: price.advanceDuePaise,
              dueDate: new Date(),
            },
            {
              bookingId: booking.id,
              sequence: 2,
              label: "Balance",
              amountPaise: price.balancePaise,
              // Balance falls due a fortnight before departure. Snapshot, so
              // moving the trip later doesn't silently re-bill this booking.
              dueDate: new Date(trip.startDate.getTime() - 15 * 86_400_000),
            },
          ],
        });
      }

      return { ...booking, holdExpiresAt };
    });
  } catch (e) {
    const code = seatErrorFrom(e);
    if (code === "SEATS_GONE") {
      return { ok: false, error: "Those seats have just gone. Try a smaller party or another batch.", code };
    }
    if (code === "NOT_BOOKABLE") {
      return { ok: false, error: "This trip is no longer open for booking.", code };
    }
    throw e;
  }

  // ── 2. Ask Razorpay for an order (no lock held) ──────────────────────
  const order = await razorpay().orders.create({
    amount: amountPaise,
    currency: "INR",
    // Our id in their dashboard, so a support call can be traced both ways.
    receipt: created.reference,
    notes: {
      bookingId: created.id,
      reference: created.reference,
      tripSlug: trip.slug,
      tripTitle: trip.title,
      seats: String(seats),
      kind,
      // So a refund or a dispute can be reconciled from their dashboard
      // without opening ours.
      bookingAmountPaise: String(bookingAmountPaise),
      convenienceFeePaise: String(fee.feePaise),
    },
  });

  // ── 3. Record the order against the booking ──────────────────────────
  await prisma.payment.create({
    data: {
      bookingId: created.id,
      method: "RAZORPAY",
      status: "CREATED",
      amountPaise,
      convenienceFeePaise: fee.feePaise,
      convenienceFeeRateBp: fee.rateBp || null,
      currency: "INR",
      razorpayOrderId: order.id,
    },
  });

  return {
    ok: true,
    orderId: order.id,
    amountPaise,
    bookingAmountPaise,
    convenienceFeePaise: fee.feePaise,
    convenienceFeeRateBp: fee.rateBp,
    currency: "INR",
    reference: created.reference,
    bookingId: created.id,
    kind,
    holdExpiresAt: created.holdExpiresAt,
  };
}

/**
 * Works out which seat function refused us, and why.
 *
 * Same shape as the copy in app/trips/[slug]/book/actions.ts: reserve_seats()
 * distinguishes its failure modes with a HINT because both raise P0001, and
 * Prisma drops the hint from the message — it survives several `cause` levels
 * down on the underlying pg error.
 */
function seatErrorFrom(e: unknown): "SEATS_GONE" | "NOT_BOOKABLE" | null {
  const parts: string[] = [];
  let node: unknown = e;
  for (let depth = 0; node && depth < 6; depth++) {
    const obj = node as { hint?: unknown; message?: unknown; cause?: unknown };
    if (typeof obj.hint === "string") parts.push(obj.hint);
    if (typeof obj.message === "string") parts.push(obj.message);
    node = obj.cause;
  }
  const haystack = parts.join(" | ");
  if (/INSUFFICIENT_SEATS|no seats available|seat\(s\) available/i.test(haystack)) return "SEATS_GONE";
  if (/TRIP_NOT_PUBLISHED|TRIP_NOT_FOUND|not open for booking|trip not found/i.test(haystack)) return "NOT_BOOKABLE";
  return null;
}
