"use server";

import { getSessionProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { paymentsConfigured, razorpay } from "@/lib/payments/client";

export type BalanceOrder =
  | { ok: true; orderId: string; amountPaise: number; keyId: string }
  | { ok: false; error: string };

/**
 * An order for whatever is left on a booking.
 *
 * Deliberately NOT createPaymentOrder: there are no seats to hold and no
 * booking to create — those already exist. This only needs an amount and an
 * order, and reusing the booking path would take a second seat hold for a
 * booking that already owns its seats.
 *
 * The amount is derived from the booking row, never from the request. A
 * client that could name its own balance could pay ₹1.
 */
export async function startBalancePayment(input: {
  reference: string;
}): Promise<BalanceOrder> {
  const profile = await getSessionProfile();
  if (!profile) return { ok: false, error: "Sign in again to continue." };

  if (!paymentsConfigured()) {
    return { ok: false, error: "Online payment isn't available right now. Message us and we'll help." };
  }

  const booking = await prisma.booking.findFirst({
    // Scoped by profile as well as reference — the reference is guessable
    // enough that it must never be the only thing between one customer and
    // another's booking.
    where: { reference: input.reference, profileId: profile.id },
    select: {
      id: true, reference: true, status: true,
      totalPaise: true, amountPaidPaise: true,
      trip: { select: { slug: true, title: true } },
      payments: {
        where: { status: "CREATED", razorpayOrderId: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { razorpayOrderId: true, amountPaise: true },
      },
    },
  });

  if (!booking) return { ok: false, error: "We couldn't find that booking." };

  if (!["CONFIRMED", "REQUESTED"].includes(booking.status)) {
    return { ok: false, error: "This booking isn't active, so there's nothing to pay." };
  }

  const balancePaise = booking.totalPaise - booking.amountPaidPaise;
  if (balancePaise <= 0) {
    return { ok: false, error: "This booking is fully paid — nothing left to settle." };
  }

  // Reuse an unpaid order for the same amount rather than making another.
  // Clicking twice should reopen the same checkout, not leave a trail of
  // abandoned orders in the Razorpay dashboard.
  const existing = booking.payments[0];
  if (existing?.razorpayOrderId && existing.amountPaise === balancePaise) {
    return {
      ok: true,
      orderId: existing.razorpayOrderId,
      amountPaise: existing.amountPaise,
      keyId: process.env.RAZORPAY_KEY_ID!,
    };
  }

  const order = await razorpay().orders.create({
    amount: balancePaise,
    currency: "INR",
    receipt: booking.reference,
    notes: {
      bookingId: booking.id,
      reference: booking.reference,
      tripSlug: booking.trip.slug,
      kind: "BALANCE",
    },
  });

  await prisma.payment.create({
    data: {
      bookingId: booking.id,
      method: "RAZORPAY",
      status: "CREATED",
      amountPaise: balancePaise,
      currency: "INR",
      razorpayOrderId: order.id,
    },
  });

  return {
    ok: true,
    orderId: order.id,
    amountPaise: balancePaise,
    keyId: process.env.RAZORPAY_KEY_ID!,
  };
}
