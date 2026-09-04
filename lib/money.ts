/**
 * Keeping money inputs to actual money.
 *
 * A bare `<input inputMode="decimal">` still accepts `-`, `e`, `+` and any
 * number of decimal points, because inputMode is a hint to the on-screen
 * keyboard and nothing more — it constrains what a phone offers, never what
 * a browser accepts. `type="number"` is no better: it allows the same
 * characters and reports an empty string for anything it dislikes, so a typo
 * silently becomes zero.
 *
 * Left alone, "-1100" reaches the server as a negative amount. Most paths
 * would refuse it — Zod positives, database CHECK constraints — but "most"
 * is the wrong number, and an admin should not be able to type it in the
 * first place.
 *
 * Applied at the keystroke rather than on submit, so the field simply cannot
 * hold a value that isn't a plain positive amount. There is no error message
 * because there is no error state: the character never lands.
 */

/** Digits and at most one decimal point, at most two places after it. */
export function sanitiseAmountInput(raw: string): string {
  // Strip everything that isn't a digit or a dot — this is what removes the
  // minus sign, "e" notation and stray currency symbols.
  const cleaned = raw.replace(/[^\d.]/g, "");

  // Collapse extra dots: "12.3.4" is a typo, and the intent is "12.34".
  const [whole, ...rest] = cleaned.split(".");
  const decimals = rest.join("");

  if (rest.length === 0) return whole;
  // Rupees and paise. Nothing here is priced in thousandths.
  return `${whole}.${decimals.slice(0, 2)}`;
}

/** Rupees typed by a person → integer paise. Never negative, never NaN. */
export function amountToPaise(raw: string | undefined | null): number {
  const n = Number(sanitiseAmountInput(raw ?? ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}
