import type { MoodEntry } from "@/lib/queries/trips";

const SCALE = 5;

/**
 * At-a-glance read on what kind of trip this is.
 *
 * Sorted strongest-first on purpose. Unsorted, six rows of dots are six
 * unrelated facts you have to read one by one; sorted, the filled dots form
 * a descending staircase and the shape itself tells you the answer before
 * you've read a single label.
 *
 * Dots rather than bars: these are impressions, and a progress bar implies a
 * precision nobody can claim about how "adventurous" a trip is.
 */
export function Moodboard({ entries }: { entries: MoodEntry[] }) {
  if (entries.length === 0) return null;

  const sorted = [...entries].sort((a, b) => b.value - a.value);
  const strongest = sorted.filter((e) => e.value >= 4).slice(0, 2);
  const lightest = sorted.filter((e) => e.value <= 2).slice(-1);

  // A plain-language summary, so the point survives even if someone never
  // decodes the dots.
  const summary = [
    strongest.length ? `Big on ${strongest.map((e) => e.label.toLowerCase()).join(" and ")}` : null,
    lightest.length ? `easy on ${lightest[0].label.toLowerCase()}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section
      aria-label="Trip moodboard"
      className="overflow-hidden rounded-3xl bg-navy text-cream"
    >
      <div className="relative px-5 py-8 md:px-12 md:py-11">
        <div className="grain opacity-[0.06]" aria-hidden />

        <header className="relative">
          <p className="font-script text-2xl text-yellow">What this trip feels like</p>
          {summary && (
            <p className="mt-1.5 max-w-lg font-display text-xl leading-snug tracking-tight text-cream md:text-2xl">
              {summary}.
            </p>
          )}
        </header>

        <dl className="relative mt-8 flex flex-col gap-px overflow-hidden rounded-2xl border border-cream/10 md:mt-9">
          {sorted.map((entry) => (
            <div
              key={entry.label}
              className="flex items-center gap-3 bg-cream/[0.04] px-3.5 py-3 md:gap-4 md:px-5"
            >
              <dt className="min-w-0 flex-1 text-[0.9rem] leading-tight text-cream/85 md:text-base">
                {entry.label}
              </dt>

              {/* Dots are decorative; the number beside them is what a screen
                  reader announces, and what keeps this legible if the dot
                  colours are indistinguishable. */}
              <dd className="flex flex-none items-center gap-2 md:gap-3">
                <span aria-hidden className="flex items-center gap-1 md:gap-1.5">
                  {Array.from({ length: SCALE }, (_, i) => (
                    <span
                      key={i}
                      className={
                        "h-2 w-2 rounded-full md:h-[11px] md:w-[11px] " +
                        (i < entry.value
                          ? "bg-yellow"
                          : "border border-cream/30 bg-transparent")
                      }
                    />
                  ))}
                </span>
                <span className="w-7 text-right font-display text-[0.8rem] tabular-nums text-cream/60 md:w-8 md:text-sm">
                  {entry.value}
                  <span className="text-cream/35">/{SCALE}</span>
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
