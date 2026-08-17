/**
 * Date handling for filters and forms.
 *
 * Dates arrive from URLs, where anything can be typed. `new Date("banana")`
 * gives an Invalid Date, and passing that into a query doesn't error — it
 * quietly matches nothing, so a mistyped filter looks exactly like "you have
 * no bookings". These helpers make bad input fall out of the filter instead
 * of emptying the screen.
 */

/** A `yyyy-mm-dd` filter value, or null if it isn't a real date. */
export function parseDateFilter(value: string | undefined | null): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  // Reject anything that isn't the shape <input type="date"> produces, so
  // "2026-13-45" is refused rather than rolled forward into 2027.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;

  const date = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;

  // Date rolls impossible values over — 2026-02-31 becomes 3 March. Round
  // tripping catches that.
  return date.toISOString().slice(0, 10) === trimmed ? date : null;
}

/** End of the given day, for an inclusive "to" bound. */
export function endOfDay(date: Date) {
  return new Date(date.getTime() + 86_399_999);
}

/** True when both ends are real dates and they're the wrong way round. */
export function isReversedRange(from?: string | null, to?: string | null) {
  const a = parseDateFilter(from);
  const b = parseDateFilter(to);
  return Boolean(a && b && a > b);
}

/** Today as `yyyy-mm-dd`, for capping date inputs in the browser. */
export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** The latest birth date that still makes someone `years` old today. */
export function latestBirthDateFor(years: number) {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
}
