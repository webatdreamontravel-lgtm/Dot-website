/**
 * One phone number, one shape.
 *
 * The same number was reaching the database as "8903413149",
 * "08903413149" and "+918903413149" depending on which form it came
 * through — which makes searching for a customer by phone a lottery, and
 * makes two records for one person look like two people.
 *
 * Everything here works in national digits: exactly ten, no country code, no
 * leading zero. The +91 is presentation, added at the edges, because it is
 * the same for every number we hold and storing it repeats a constant ten
 * thousand times.
 */

/** Shown beside every phone input. One place to change it. */
export const PHONE_COUNTRY_CODE = "+91";
/** Indian mobile numbers are ten digits. */
export const PHONE_NATIONAL_DIGITS = 10;
/** And they begin with one of these. Catches a transposed digit. */
const MOBILE_FIRST_DIGIT = /^[6-9]/;

/**
 * Reduces anything a human might type to the ten national digits.
 *
 * Handles the three shapes already in the database, plus spaces, dashes and
 * brackets. Returns "" when there is nothing usable, so callers can treat
 * empty as absent rather than juggling null.
 */
export function toNationalDigits(raw: string | null | undefined): string {
  if (!raw) return "";
  let d = raw.replace(/\D/g, "");

  // "+918903413149" and "918903413149" both carry the country code.
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  // "08903413149" — the old STD-dialling habit.
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  // "00918903413149"
  else if (d.length === 14 && d.startsWith("0091")) d = d.slice(4);

  // Deliberately NOT truncated. An eleven-digit number with no recognisable
  // country code is a typo, not a number with something extra on the end —
  // trimming it would turn a mistake into a valid-looking wrong number and
  // send the trip lead to a stranger. Return it as-is and let isValidPhone
  // refuse it.
  return d;
}

/** True when this is a plausible Indian mobile number. */
export function isValidPhone(raw: string | null | undefined): boolean {
  const d = toNationalDigits(raw);
  return d.length === PHONE_NATIONAL_DIGITS && MOBILE_FIRST_DIGIT.test(d);
}

/**
 * What a partially-typed number should become as it is typed.
 *
 * Deliberately lenient: it strips what can't belong and truncates at ten,
 * but never rejects, because an input that silently refuses a keystroke is
 * maddening. Validity is judged on submit.
 */
export function sanitisePhoneInput(raw: string): string {
  return raw.replace(/\D/g, "").replace(/^(91|0)(?=\d{10})/, "").slice(0, PHONE_NATIONAL_DIGITS);
}

/** For display: "+91 89034 13149". */
export function formatPhone(raw: string | null | undefined): string {
  const d = toNationalDigits(raw);
  if (d.length !== PHONE_NATIONAL_DIGITS) return raw ?? "";
  return `${PHONE_COUNTRY_CODE} ${d.slice(0, 5)} ${d.slice(5)}`;
}

/** For tel: links, which want no spaces. */
export function phoneHref(raw: string | null | undefined): string {
  const d = toNationalDigits(raw);
  return d ? `tel:${PHONE_COUNTRY_CODE}${d}` : "";
}
