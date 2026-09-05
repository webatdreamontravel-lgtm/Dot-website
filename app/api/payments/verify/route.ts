import { NextResponse } from "next/server";

import { getSessionProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyCheckoutSignature } from "@/lib/payments/signature";
import { settlePayment } from "@/lib/payments/settle";

/**
 * The browser calling back after Razorpay's checkout closes successfully.
 *
 * This is an optimisation, not the source of truth — the webhook confirms the
 * same payment whether or not this ever runs. Its job is to make the happy
 * path feel instant instead of making the customer stare at a spinner while
 * a webhook works its way over.
 *
 * Because settlePayment() is idempotent, this racing the webhook is fine:
 * whichever arrives second sees the payment already captured and does
 * nothing.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const profile = await getSessionProfile();
  if (!profile) {
    return NextResponse.json({ error: "Sign in and try again." }, { status: 401 });
  }

  let body: { razorpay_order_id?: string; razorpay_payment_id?: string; razorpay_signature?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const orderId = body.razorpay_order_id;
  const paymentId = body.razorpay_payment_id;

  if (!orderId || !paymentId) {
    return NextResponse.json({ error: "Missing payment details." }, { status: 400 });
  }

  // The signature is the real proof this payment happened, so it's checked
  // before anything is written.
  if (!verifyCheckoutSignature(orderId, paymentId, body.razorpay_signature ?? null)) {
    return NextResponse.json({ error: "Could not verify that payment." }, { status: 400 });
  }

  // A valid signature proves the payment is genuine, not that it belongs to
  // the person holding this session. Without this check a signed-in customer
  // replaying someone else's callback could read back a booking reference
  // that isn't theirs.
  const owned = await prisma.payment.findUnique({
    where: { razorpayOrderId: orderId },
    select: { booking: { select: { profileId: true } } },
  });
  if (!owned) {
    return NextResponse.json({ error: "We don't have a record of that order." }, { status: 404 });
  }
  if (owned.booking.profileId !== profile.id) {
    return NextResponse.json({ error: "That payment belongs to another account." }, { status: 403 });
  }

  const result = await settlePayment({
    orderId,
    paymentId,
    amountPaise: (await amountFor(orderId)) ?? 0,
    signatureVerified: true,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    reference: result.reference,
    // The customer needs to know when the seat didn't survive the wait.
    seatLost: result.state === "SEAT_LOST",
  });
}

/**
 * The amount is read from our own Payment row rather than the request body.
 *
 * The browser could claim any figure. settlePayment cross-checks what it's
 * given against what we recorded, so passing the client's number through
 * would turn that check into a tautology.
 */
async function amountFor(orderId: string): Promise<number | null> {
  const p = await prisma.payment.findUnique({
    where: { razorpayOrderId: orderId },
    select: { amountPaise: true },
  });
  return p?.amountPaise ?? null;
}
