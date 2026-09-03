/**
 * When the balance on a booking falls due.
 *
 * The preferred rule is a fixed number of days before departure — the team
 * pays hotels and transport ahead of the trip, so the money needs to be in
 * before then, not on the morning of.
 *
 * The subtlety is late bookings. A plain `startDate − 15 days` produces a
 * date in the PAST for anyone booking inside that window: someone paying an
 * advance three days before departure gets a balance that was due twelve
 * days ago, overdue before the advance has even cleared. A debt cannot be
 * late before it exists, and an "overdue" flag that fires on every late
 * booking is a flag nobody will trust.
 *
 * So the rule is: the preferred date, or a short grace period, whichever is
 * LATER — and never later than the day before departure.
 *
 *   60 days out  →  due in 45 days   the preferred rule, plenty of room
 *   15 days out  →  due in 3 days    preferred lands today; grace wins
 *    3 days out  →  due in 2 days    grace would be day 3; departure caps it
 *    1 day out   →  due today        nothing later is any use
 *
 * The grace period is what stops the rule being non-monotonic. Without it,
 * booking 15 days out means "pay today" while booking 14 days out means
 * "pay in 13 days" — a day's delay buying nearly two more weeks, which is
 * absurd on its face and would be reported as a bug the first time someone
 * noticed it.
 *
 * Deliberately pure and date-only: the column is `@db.Date`, the reminder
 * schedule counts whole days, and a time-of-day here would only introduce
 * timezone drift between the two.
 */

const DAY_MS = 86_400_000;

/**
 * The least time anyone gets to pay a balance, however late they booked.
 *
 * Not configurable: it is a fairness floor rather than a business lever, and
 * a setting that could be set to zero would quietly recreate the bug this
 * exists to prevent.
 */
const GRACE_DAYS = 3;

/** Midnight UTC on the calendar day of `d`. Date columns compare as days. */
function utcMidnight(d: Date): Date {
  const out = new Date(d.getTime());
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

export const DEFAULT_BALANCE_DUE_DAYS_BEFORE = 15;

export function balanceDueDate(
  startDate: Date,
  daysBefore: number = DEFAULT_BALANCE_DUE_DAYS_BEFORE,
  now: Date = new Date(),
): Date {
  const today = utcMidnight(now);
  const start = utcMidnight(startDate);

  const preferred = new Date(start.getTime() - Math.max(0, daysBefore) * DAY_MS);

  // The earliest we would ever demand it: a few days from now, but never
  // after the day before departure — money that arrives while the bus is
  // moving is no use to anyone.
  const dayBefore = new Date(start.getTime() - DAY_MS);
  const graced = new Date(today.getTime() + GRACE_DAYS * DAY_MS);
  let floor = graced < dayBefore ? graced : dayBefore;
  // Booked on or after the departure date: there is no future date left to
  // name, so it is due now.
  if (floor < today) floor = today;

  return preferred > floor ? preferred : floor;
}
