import "server-only";

import { prisma } from "@/lib/prisma";
import { DEFAULT_BALANCE_DUE_DAYS_BEFORE } from "@/lib/booking/instalments";

/**
 * When balance reminders go out.
 *
 * Two mechanisms, because they do different jobs:
 *
 *   daysBefore      one-off nudges at fixed distances — "your balance is due
 *                   in three weeks". Easy to ignore, and meant to be.
 *   dailyFinalDays  a reminder EVERY morning for the last stretch before
 *                   departure, until the balance is cleared. This is the one
 *                   that actually collects money: someone who has ignored two
 *                   polite emails will act when it arrives daily and the trip
 *                   is on Saturday.
 *
 * Kept in site_settings rather than in code so the founders can change the
 * cadence without a deploy — the right rhythm is something you learn from a
 * few trips, not something you can decide up front.
 *
 * A missing or malformed row falls back to the defaults below rather than
 * throwing. A broken setting should mean "send the usual reminders", never
 * "silently stop chasing money people owe".
 */

export const BALANCE_REMINDER_KEY = "balance_reminder";

export type BalanceReminderConfig = {
  enabled: boolean;
  /** One-off reminders at these exact distances, in days. May be empty. */
  daysBefore: number[];
  /**
   * Send every day when the trip is this many days away or fewer.
   * 5 means the final five mornings — days 5, 4, 3, 2 and 1.
   * Departure day itself is deliberately excluded: an email about money on
   * the morning someone is boarding a bus helps nobody.
   */
  dailyFinalDays: number;
  /**
   * How many days before departure the balance is due.
   *
   * Lives here rather than in code because it is the same conversation as
   * the reminder cadence — "when do they owe it, and when do we chase" is
   * one decision, and splitting it across a config row and a hardcoded
   * constant is how the two drift apart.
   *
   * Only a preference: a booking made inside this window gets a later date
   * rather than one in the past. See balanceDueDate().
   */
  balanceDueDaysBefore: number;
};

const DEFAULTS: BalanceReminderConfig = {
  enabled: true,
  daysBefore: [21, 14],
  dailyFinalDays: 5,
  balanceDueDaysBefore: DEFAULT_BALANCE_DUE_DAYS_BEFORE,
};

const intOr = (v: unknown, fallback: number, max = 365) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max ? Math.trunc(v) : fallback;

export async function getBalanceReminderConfig(): Promise<BalanceReminderConfig> {
  try {
    const row = await prisma.siteSetting.findUnique({
      where: { key: BALANCE_REMINDER_KEY },
      select: { value: true },
    });
    if (!row?.value || typeof row.value !== "object" || Array.isArray(row.value)) {
      return { ...DEFAULTS };
    }

    const v = row.value as Record<string, unknown>;

    const days = Array.isArray(v.daysBefore)
      ? [
          ...new Set(
            v.daysBefore
              .filter((d): d is number => typeof d === "number" && d >= 0 && d <= 365)
              .map(Math.trunc),
          ),
        ].sort((a, b) => b - a)
      : DEFAULTS.daysBefore;

    const dailyFinalDays = intOr(v.dailyFinalDays, DEFAULTS.dailyFinalDays, 60);

    return {
      // Enabled only if there is actually something to send.
      enabled: v.enabled !== false && (days.length > 0 || dailyFinalDays > 0),
      daysBefore: days,
      dailyFinalDays,
      balanceDueDaysBefore: intOr(
        v.balanceDueDaysBefore,
        DEFAULTS.balanceDueDaysBefore,
        365,
      ),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

/**
 * Every day-offset a reminder should go out on, highest first.
 *
 * Three sources, merged and de-duplicated so nothing sends twice:
 *
 *   balanceDueDaysBefore  ALWAYS included. A due date the customer was never
 *                         told about is not a deadline, it is a trap — and
 *                         it is the one day where "your balance is due" is
 *                         literally true rather than approximately true.
 *                         Including it here rather than asking someone to
 *                         remember to add it to daysBefore means the two can
 *                         never fall out of step.
 *   daysBefore            optional extra nudges, further out. May be empty.
 *   dailyFinalDays        the daily push, which is what actually collects.
 *
 * The daily window is also the only part that fires reliably for every
 * booking: a one-off offset only matches if the booking already existed on
 * exactly that day, so someone who books eighteen days before departure
 * never sees a twenty-one-day nudge.
 */
export function reminderOffsets(config: BalanceReminderConfig): number[] {
  const daily = Array.from({ length: config.dailyFinalDays }, (_, i) => i + 1);
  return [
    ...new Set([config.balanceDueDaysBefore, ...config.daysBefore, ...daily]),
  ]
    .filter((d) => d > 0)
    .sort((a, b) => b - a);
}
