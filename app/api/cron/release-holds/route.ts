import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

/**
 * Returns seats from checkouts nobody finished.
 *
 * reserve_seats() hands out a 15-minute hold before the customer is sent to
 * Razorpay. Most come back; some close the tab. Without this, every abandoned
 * checkout parks a seat that never returns, and a popular trip sells out to
 * people who never paid.
 *
 * The database function does the work and is safe to run concurrently — it
 * only touches holds that are already expired, unreleased and unlinked, so
 * two overlapping runs can't release the same hold twice or race a payment
 * that is landing at that moment.
 *
 * Excluded from middleware (see middleware.ts) because it carries no session;
 * CRON_SECRET is what authenticates it.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret) {
    // Refuse rather than run unauthenticated. An open endpoint that mutates
    // seat state is not something to leave lying around because an env var
    // was forgotten.
    return NextResponse.json({ error: "CRON_SECRET is not set." }, { status: 503 });
  }

  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  }

  const [{ release_expired_holds: released }] = await prisma.$queryRaw<
    { release_expired_holds: number }[]
  >`SELECT release_expired_holds()`;

  // Bookings whose hold lapsed are dead too — they can never be paid, and
  // leaving them PENDING_PAYMENT makes the admin list lie about demand.
  const expired = await prisma.booking.updateMany({
    where: { status: "PENDING_PAYMENT", holdExpiresAt: { lt: new Date() } },
    data: { status: "EXPIRED", pendingHoldId: null },
  });

  return NextResponse.json({
    ok: true,
    holdsReleased: Number(released),
    bookingsExpired: expired.count,
  });
}
