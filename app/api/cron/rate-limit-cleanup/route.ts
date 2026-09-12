import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { retentionDays } from "@/lib/rateLimit";

/**
 * Deletes spent rate-limit windows.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not set." }, { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  }

  const days = retentionDays();

  try {
    const deleted = await prisma.$executeRaw`
      DELETE FROM rate_limit
      WHERE window_start < now() - make_interval(days => ${days})`;

    const remaining = await prisma.rateLimit.count();

    return NextResponse.json({
      ok: true,
      deleted,
      remaining,
      retentionDays: days,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[cron] rate-limit cleanup failed:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
