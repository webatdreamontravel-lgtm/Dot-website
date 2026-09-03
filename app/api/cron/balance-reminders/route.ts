import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getBalanceReminderConfig, reminderOffsets } from "@/lib/config/reminders";
import {
  daysUntil,
  reminderSelect,
  sendBalanceReminder,
} from "@/lib/payments/balanceReminder";

/**
 * Chases unpaid balances, on the schedule in site_settings.
 *
 * Runs every morning. Two kinds of reminder come out of one pass:
 *
 *   - one-off nudges at fixed distances (21 and 14 days by default)
 *   - a DAILY reminder for the final stretch, until the balance is cleared
 *
 * The daily one is the part that collects money. Someone who ignored two
 * polite emails acts when one arrives every morning and the trip is on
 * Saturday.
 *
 * Idempotency is the dedupeKey, not the schedule: it carries the booking and
 * the day offset, so re-running this — after a failure, or twice by accident —
 * cannot send a second copy of the same morning's email. That matters more
 * than it sounds; a cron that double-fires and chases someone twice for the
 * same money is worse than one that misses a day.
 *
 * Excluded from middleware (see middleware.ts); CRON_SECRET authenticates it.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The UTC date N days from today. Date columns compare as calendar days. */
function dateIn(daysAhead: number) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + daysAhead);
  return d;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not set." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  }

  const config = await getBalanceReminderConfig();
  if (!config.enabled) return NextResponse.json({ ok: true, skipped: "disabled" });

  const offsets = reminderOffsets(config);
  if (offsets.length === 0) return NextResponse.json({ ok: true, skipped: "no schedule" });

  /**
   * One query for the whole schedule rather than one per offset.
   *
   * The offsets span a range (21 down to 1 by default), so fetching the
   * window once and matching in memory is a single round trip instead of
   * seven — and it stays one round trip however long the schedule gets.
   */
  const furthest = Math.max(...offsets);
  const due = await prisma.booking.findMany({
    where: {
      status: { in: ["CONFIRMED", "REQUESTED"] },
      trip: {
        startDate: { gte: dateIn(1), lte: dateIn(furthest) },
        isActive: true,
        deletedAt: null,
      },
    },
    select: reminderSelect,
  });

  const wanted = new Set(offsets);
  let sent = 0;
  let skipped = 0;
  /**
   * Why the skipped ones were skipped.
   *
   * A bare count can't tell "nobody owes anything" apart from "this already
   * went out this morning" or "the schedule doesn't name today" — and those
   * are the three things anyone reading this response is trying to
   * distinguish. Re-running the job is the normal way to check it works, so
   * the second run has to be readable, not just quiet.
   */
  const reasons: Record<string, number> = {};
  const count = (reason: string) => {
    reasons[reason] = (reasons[reason] ?? 0) + 1;
    skipped++;
  };
  const errors: string[] = [];

  for (const booking of due) {
    const offset = daysUntil(booking.trip.startDate);
    // Only on a day the schedule actually names.
    if (!wanted.has(offset)) {
      count("not-a-reminder-day");
      continue;
    }

    const result = await sendBalanceReminder(booking, {
      dedupeKey: `balance_reminder:${booking.id}:${offset}`,
    });

    if (!result.ok) errors.push(`${booking.reference}: ${result.error}`);
    else if (result.sent) sent++;
    else count(result.reason);
  }

  return NextResponse.json({
    ok: true,
    schedule: {
      dueDay: config.balanceDueDaysBefore,
      oneOff: config.daysBefore,
      dailyFinalDays: config.dailyFinalDays,
      offsets,
    },
    considered: due.length,
    sent,
    skipped,
    ...(skipped ? { skippedBecause: reasons } : {}),
    ...(errors.length ? { errors } : {}),
  });
}
