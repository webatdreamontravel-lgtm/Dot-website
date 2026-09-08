import { NextResponse } from "next/server";

import { getSessionProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * "Has anything changed on this trip's bookings?" — and nothing else.
 *
 * The admin sits on the bookings screen while people book, and until now the
 * only way to see a new one was to refresh. This is what the page polls.
 *
 * It deliberately returns a signature rather than the rows. Sending the table
 * on every poll would be the same page load on every poll; a count and the
 * latest `updated_at` are two aggregates over one index, and the page only
 * does real work on the tick where they actually move.
 *
 * `updatedAt`, not `createdAt`: a booking being cancelled, paid or refunded
 * changes the table just as much as a new one arriving, and only the former
 * moves. Counting alone would miss all three.
 *
 * Returns JSON on refusal rather than redirecting — requireAdmin()'s redirect
 * reaches fetch() as an opaque HTML response the caller can't read.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getSessionProfile();
  if (!profile || profile.role !== "ADMIN") {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const { id } = await params;
  const agg = await prisma.booking.aggregate({
    where: { tripId: id },
    _count: { _all: true },
    _max: { updatedAt: true },
  });

  return NextResponse.json(
    {
      count: agg._count._all,
      latest: agg._max.updatedAt?.toISOString() ?? null,
    },
    // The whole point is freshness — a cached answer is the one thing that
    // would make this pointless.
    { headers: { "Cache-Control": "no-store" } },
  );
}
