import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  CloudRain,
  Compass,
  Flame,
  Mountain,
  PartyPopper,
  Plane,
  Route,
  Sparkles,
  TreePalm,
  X,
  type LucideIcon,
} from "lucide-react";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { TripCard } from "@/components/trip/TripCard";
import { AnimatedHeading } from "@/components/shared/AnimatedHeading";
import { tripCategories } from "@/lib/data/siteConfig";
import { getUpcomingTrips, type TripCardView } from "@/lib/queries/trips";
import { isReversedRange, parseDateFilter } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { TripFilters } from "./TripFilters";

export const metadata: Metadata = {
  title: "All Upcoming Trips",
  description:
    "Browse all upcoming Dream On Travel community trips — DOT Signatures, Western Ghats escapes, coastal carnivals, abroad voyages and more.",
};

export const revalidate = 60;

type Query = { category?: string; q?: string; from?: string; to?: string };

/**
 * A line icon per category, keyed by slug.
 *
 * Replaces the emoji the chips used to carry. Emoji are a font, so they
 * rendered differently on every platform, could not take the selected
 * colour, and sat on the baseline rather than above the label — none of
 * which a filter strip can afford when the icon is the thing being scanned.
 * Compass is the fallback, and the one "All trips" uses.
 */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  all: Compass,
  "dot-signatures": Sparkles,
  "long-trips": Route,
  "coastal-carnivals": TreePalm,
  "cultural-feast": Flame,
  "monsoon-trips": CloudRain,
  "western-ghats": Mountain,
  "festival-specials": PartyPopper,
  abroad: Plane,
};

export default async function TripsListingPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const params = await searchParams;
  const all = await getUpcomingTrips();

  const q = (params.q ?? "").trim();
  // Normalised through parseDateFilter, so "2026-13-45" or "banana" falls out
  // of the filter instead of quietly matching nothing and reading as "we have
  // no trips".
  const from = isoDay(params.from);
  const to = isoDay(params.to);

  // Filtering by label rather than slug because that's what the trip rows
  // store today. Matching is case-insensitive so a stray capital in the
  // admin doesn't silently empty the page.
  const active = tripCategories.find((c) => c.slug === params.category);
  const category = active?.slug ?? "";

  const trips = all.filter(
    (t) =>
      (!active || t.category?.toLowerCase() === active.label.toLowerCase()) &&
      matchesSearch(t, q) &&
      departsWithin(t, from, to),
  );

  const filtered = Boolean(q || from || to || active);
  const reversed = isReversedRange(from, to);

  /** The current URL with one filter changed — every other filter kept. */
  const href = (changes: Partial<Query>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ category, q, from, to, ...changes })) {
      if (value) next.set(key, value);
    }
    const qs = next.toString();
    return qs ? `/trips?${qs}` : "/trips";
  };

  return (
    <>
      <Navbar variant="solid" />
      <main className="bg-cream pb-24">
        <TripFilters
          q={q}
          from={from}
          to={to}
          category={category}
          heading={
            <>
              <p className="font-script text-2xl text-yellow">Vaanga, polama →</p>
              <AnimatedHeading as="h1" className="mt-2 text-5xl text-cream md:text-7xl">
                All upcoming <span className="italic text-yellow">trips</span>
              </AnimatedHeading>
              <p className="mt-5 max-w-xl text-lg text-cream/85">
                Pick a date, pack a bag. We&apos;ve scouted every one of these so you
                don&apos;t have to.
              </p>
            </>
          }
          chips={[{ slug: "all", label: "All trips" }, ...tripCategories].map((c) => {
            const isActive = c.slug === "all" ? !active : c.slug === category;
            const Icon = CATEGORY_ICONS[c.slug] ?? Compass;
            return (
              <Link
                key={c.slug}
                // Category no longer throws away the search and the dates.
                // It used to link at `/trips?category=x`, so picking one
                // silently emptied both other filters.
                href={href({ category: c.slug === "all" ? "" : c.slug })}
                scroll={false}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "flex h-[70px] w-[80px] flex-none flex-col items-center justify-center gap-1 md:h-[78px] md:w-[104px] md:gap-1.5",
                  "rounded-2xl border px-2 text-center transition duration-200",
                  isActive
                    ? // Teal carries the selection through the border and the
                      // icon, which are non-text and clear 3:1 at 4.15. The
                      // label stays navy: teal on this tint is 3.68, and a
                      // category name is text.
                      "border-teal bg-teal/10 text-navy"
                    : "border-transparent text-navy/70 hover:border-navy/10 hover:bg-navy/[0.035]",
                )}
              >
                <Icon
                  aria-hidden
                  strokeWidth={1.6}
                  className={cn("h-5 w-5 flex-none", isActive ? "text-teal" : "text-navy/65")}
                />
                <span className="text-[0.75rem] font-medium leading-tight">{c.label}</span>
              </Link>
            );
          })}
        >
          <div className="mx-auto max-w-7xl px-6 md:px-8">
            {/* The count is what tells someone their filter did anything at
                all. aria-live so it is announced rather than only seen. */}
            <div
              aria-live="polite"
              className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 text-[0.85rem] text-navy/65"
            >
              <span className="font-medium text-navy/75">
                {trips.length} {trips.length === 1 ? "trip" : "trips"}
              </span>

              {q && (
                <FilterChip href={href({ q: "" })} label={`“${q}”`} />
              )}
              {(from || to) && (
                <FilterChip href={href({ from: "", to: "" })} label={rangeLabel(from, to)} />
              )}
              {active && (
                <FilterChip href={href({ category: "" })} label={active.label} />
              )}
              {filtered && (
                <Link href="/trips" scroll={false} className="underline underline-offset-4 hover:text-navy">
                  Clear all
                </Link>
              )}
            </div>

            {/* A back-to-front range matches nothing, which on screen is
                indistinguishable from having no trips. Say which it is. */}
            {reversed && (
              <p
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-xl border border-[#f0dcae] bg-[#fdf6e3] px-4 py-3 text-[0.88rem] text-[#7a4a00]"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
                Those dates are the wrong way round — the first is after the second, so nothing
                can match. Pick the range again.
              </p>
            )}

            {trips.length === 0 ? (
              <NoResults q={q} from={from} to={to} categoryLabel={active?.label} href={href} />
            ) : (
              <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
                {trips.map((trip, i) => (
                  <TripCard key={trip.slug} trip={trip} index={i} />
                ))}
              </div>
            )}
          </div>
        </TripFilters>
      </main>
      <Footer />
    </>
  );
}

function FilterChip({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      className="inline-flex items-center gap-1.5 rounded-full border border-navy/12 bg-cream-soft py-1 pl-3 pr-2 text-[0.82rem] text-navy transition hover:border-navy/25 hover:bg-yellow"
    >
      {label}
      <X className="h-3.5 w-3.5 text-navy/55" aria-hidden />
      <span className="sr-only">Remove this filter</span>
    </Link>
  );
}

/**
 * The dead end, with a way out of it.
 *
 * A bare "no results" leaves someone guessing which of three filters is the
 * one holding everything back, so each one that is on gets its own escape —
 * and the wording names what was actually searched rather than restating that
 * the list is empty.
 */
function NoResults({
  q,
  from,
  to,
  categoryLabel,
  href,
}: {
  q: string;
  from: string;
  to: string;
  categoryLabel?: string;
  href: (changes: Partial<Query>) => string;
}) {
  return (
    <div className="mt-8 rounded-3xl border border-navy/10 bg-cream-soft p-10 text-center md:p-14">
      <p className="font-display text-2xl text-navy">
        {q ? <>No trips match “{q}”</> : "Nothing in that window"}
      </p>
      <p className="mx-auto mt-3 max-w-md text-navy/65">
        {from || to
          ? `We've nothing departing ${rangeSentence(from, to)}${
              categoryLabel ? ` in ${categoryLabel}` : ""
            }. Trips are announced every few weeks — try a wider range.`
          : "New trips are announced every few weeks. Try a different search, or browse everything."}
      </p>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
        {(from || to) && (
          <Link href={href({ from: "", to: "" })} scroll={false} className="btn btn-primary">
            Any dates
          </Link>
        )}
        {q && (
          <Link
            href={href({ q: "" })}
            scroll={false}
            className="pill border border-navy/15 bg-cream text-sm text-navy transition hover:bg-yellow"
          >
            Clear the search
          </Link>
        )}
        {categoryLabel && (
          <Link
            href={href({ category: "" })}
            scroll={false}
            className="pill border border-navy/15 bg-cream text-sm text-navy transition hover:bg-yellow"
          >
            All categories
          </Link>
        )}
        <Link
          href="/trips"
          scroll={false}
          className="pill border border-navy/15 bg-cream text-sm text-navy transition hover:bg-yellow"
        >
          See every trip
        </Link>
      </div>
    </div>
  );
}

/** `YYYY-MM-DD` if it is a real calendar day, "" otherwise. */
function isoDay(value: string | undefined): string {
  return parseDateFilter(value)?.toISOString().slice(0, 10) ?? "";
}

/**
 * The trip's name, and nothing else.
 *
 * It used to also search the destination, tagline and category, which made
 * results hard to account for — a trip would turn up for a word that appears
 * nowhere on its card, and two trips sharing a category both matched a search
 * for one of them. The category is already a filter of its own.
 *
 * Every word has to appear, in any order. Whole-string matching means "kodai
 * clean" finds nothing on a trip called "Kodaikanal Clean Run", which is the
 * search someone types when they half remember the name — the case this box
 * exists for.
 */
function matchesSearch(trip: TripCardView, q: string): boolean {
  if (!q) return true;
  const name = trip.title.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => name.includes(word));
}

/**
 * Departure day inside the range, both ends inclusive.
 *
 * Departure, not overlap: "trips between these dates" has to mean one thing,
 * and the one it can be explained in a chip is the day you leave. Compared as
 * `YYYY-MM-DD` strings, which is exactly calendar-day comparison and cannot
 * drift by a day the way parsing to Date and back through a timezone can.
 */
function departsWithin(trip: TripCardView, from: string, to: string): boolean {
  const day = trip.startDate.slice(0, 10);
  return (!from || day >= from) && (!to || day <= to);
}

/** "20 Oct – 30 Nov", "From 20 Oct", "Until 30 Nov" — for the filter chip. */
function rangeLabel(from: string, to: string): string {
  if (from && to) return `${day(from)} – ${day(to)}`;
  if (from) return `From ${day(from)}`;
  return `Until ${day(to)}`;
}

/**
 * The same range, mid-sentence.
 *
 * Not rangeLabel().toLowerCase() — that took the month down with it and the
 * empty state read "we've nothing 1 oct – 5 oct".
 */
function rangeSentence(from: string, to: string): string {
  if (from && to) return `between ${day(from)} and ${day(to)}`;
  if (from) return `on or after ${day(from)}`;
  return `on or before ${day(to)}`;
}

function day(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    // Only worth the width when it isn't the year everyone is already in.
    year: y === new Date().getFullYear() ? undefined : "numeric",
  }).format(new Date(y, m - 1, d));
}
