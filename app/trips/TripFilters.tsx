"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";

import backdrop from "../../public/images/trip-backdrop-2.jpg";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2, Search, X } from "lucide-react";

import { DateRangeField } from "@/components/shared/DateRangeField";

/**
 * The trip listing's search hero: a photograph, the heading over it, and the
 * filters floating on a card at the bottom of it.
 *
 * ── Where the state lives ──
 *
 * In the URL, not in this component. A filtered view can then be sent to a
 * friend, survives a refresh, and the back button undoes one filter instead
 * of leaving the page — which is what someone comparing two date windows
 * actually does.
 *
 * Searching happens as you type. An Apply button is right in the admin, where
 * a query costs a table scan and people set four filters before they look;
 * here there are a couple of dozen trips and one field, and making someone
 * press a button to see them is a step for nothing. The button on the end is
 * still real: it flushes the debounce instead of waiting out the 300ms.
 *
 * ── Why one card and not three controls ──
 *
 * Categories, search and dates are one question — what am I looking for —
 * and three separate bars read as three unrelated ones. Gathered onto a
 * single card they read as a search, which is the shape people arrive
 * already knowing how to use.
 *
 * ── The slots ──
 *
 * `heading` and `chips` are rendered on the server and passed in, so nothing
 * that doesn't need to be interactive gets shipped to the browser. `children`
 * is the result grid, for the same reason — this wrapper only needs to know
 * it's there in order to dim it while the next set is fetched.
 */
export function TripFilters({
  q,
  from,
  to,
  category,
  heading,
  chips,
  children,
}: {
  q: string;
  from: string;
  to: string;
  category: string;
  heading: React.ReactNode;
  chips: React.ReactNode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Typing has to feel instant, so the box is driven locally and the URL
  // catches up. Re-synced from the prop for the changes this component does
  // not make: back button, and the Clear links in the chip row.
  //
  // Adjusted during render rather than in an effect — the box would otherwise
  // paint the stale term for a frame on every back navigation.
  const [term, setTerm] = useState(q);
  const [lastQ, setLastQ] = useState(q);
  if (q !== lastQ) {
    setLastQ(q);
    setTerm(q);
  }

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  /**
   * The category strip's arrows.
   *
   * Its card is deliberately narrower than the search card below it, so nine
   * tiles never fit and the row always scrolls — which is what earns a pair
   * of arrows rather than leaving them as decoration. Each is hidden at the
   * end it would do nothing at.
   *
   * Measured from a ResizeObserver and a scroll listener, both of which are
   * callbacks from the browser, so the first measurement arrives the same way
   * every later one does.
   */
  const strip = useRef<HTMLDivElement | null>(null);
  const [canScroll, setCanScroll] = useState({ left: false, right: false });

  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    const measure = () => {
      // 1px of slack: sub-pixel layout leaves scrollLeft a hair short of the
      // end, which would strand the right arrow permanently visible.
      setCanScroll({
        left: el.scrollLeft > 1,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
      });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, []);

  // Three tiles a press — enough to feel like progress, short enough that
  // nothing scrolls past unseen.
  const nudge = (direction: -1 | 1) =>
    strip.current?.scrollBy({ left: direction * 312, behavior: "smooth" });

  /**
   * Softens whichever end still has tiles behind it.
   *
   * A hard clip put a sliced half-word right beside the arrow, which read as
   * the arrow sitting on top of a tile. Faded, the row visibly continues past
   * the gutter instead. Only the scrollable end is faded — fading an end that
   * has nothing behind it would just dim the first tile for no reason.
   */
  const fadeEnds = `linear-gradient(to right, ${
    canScroll.left ? "transparent 0, #000 18px" : "#000 0"
  }, ${canScroll.right ? "#000 calc(100% - 18px), transparent 100%" : "#000 100%"})`;

  /**
   * Rebuilds the query string from what is there now plus the change.
   *
   * Empty values are dropped rather than written as `?q=`, so a URL only ever
   * carries filters that are actually on.
   */
  const push = (changes: Record<string, string>) => {
    if (timer.current) clearTimeout(timer.current);
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ q: term, from, to, category, ...changes })) {
      if (value) next.set(key, value);
    }
    const qs = next.toString();
    // replace, not push: a debounced search would otherwise leave one history
    // entry per keystroke and make the back button useless.
    startTransition(() => router.replace(qs ? `/trips?${qs}` : "/trips", { scroll: false }));
  };

  const search = (value: string) => {
    setTerm(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => push({ q: value }), 300);
  };

  return (
    <>
      <section className="relative isolate overflow-hidden pb-10 pt-32 md:pb-14 md:pt-40">
        {/* Decorative: the heading says everything this photograph does, so
            announcing it again would only lengthen the page for a screen
            reader. Statically imported, which is what lets Next generate the
            blur placeholder — without it the hero showed flat navy until the
            image landed. priority because it is the largest thing above the
            fold. */}
        <Image
          src={backdrop}
          alt=""
          aria-hidden
          fill
          priority
          placeholder="blur"
          sizes="100vw"
          className="-z-20 object-cover"
        />

        {/* ── The scrim ──
            Fitted to this photograph, not guessed, and re-fitted whenever the
            photograph changes. Cream needs 4.5:1; the brightest thing in the
            desktop crop is the turquoise shallows at rgb(161,187,189), which
            is 1.9:1 on its own.

            The weight follows the text rather than covering everything: heavy
            at the upper left over the forested headland where the heading
            sits, light at the right where the open water is and no text ever
            goes. Modelled cell by cell over a 20x10 grid of the crop — every
            cell clears 4.5:1, worst 5.11 — so the water keeps its colour at
            30% while the heading sits on 60%.

            Mobile crops to the centre column, where the pale sky at
            rgb(171,204,236) is the brightest thing and the left-hand headland
            is gone. A flat 55% is what that needs; 50% measures 4.49 and
            misses. */}
        <div aria-hidden className="absolute inset-0 -z-10 bg-navy/55 md:hidden" />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 hidden bg-gradient-to-r from-navy/60 via-navy/50 to-navy/30 md:block"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-t from-navy/50 via-transparent to-transparent"
        />

        <div className="mx-auto max-w-7xl px-6 md:px-8">
          {heading}

          {/* Two cards on desktop, one on mobile.
 
              The desktop arrangement is a narrow category band riding on top
              of a wider search bar, which makes the search read as the main
              event and the categories as a refinement of it — the order
              people use them in.
 
              That only works while the two are different widths. Below md
              both fill the column, so the overlap stopped reading as
              layering and started reading as a seam between two rectangles.
              At that size they join into a single card instead: square
              corners where they meet, one hairline between them, and no
              overlap at all. */}
          <div className="relative mx-auto mt-8 w-full max-w-4xl rounded-t-3xl border border-b-0 border-white/60 bg-white/95 px-4 pb-3 pt-3 backdrop-blur-sm md:mt-10 md:max-w-3xl md:rounded-2xl md:border-b md:pb-5 md:pt-2 md:shadow-float">
            {canScroll.left && (
              <ArrowButton side="left" onClick={() => nudge(-1)} />
            )}
            {/* Bleeds to the card's edge on mobile by cancelling its padding,
                then puts that padding back inside itself. Kept within the
                card, three tiles filled the row exactly and the fourth was
                clipped to a sliver the fade then erased — so nine categories
                looked like three, with nothing to say otherwise. */}
            <div
              ref={strip}
              style={{ maskImage: fadeEnds, WebkitMaskImage: fadeEnds }}
              className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto scroll-smooth px-4 py-0.5 md:mx-0 md:px-0"
            >
              {chips}
            </div>
            {canScroll.right && (
              <ArrowButton side="right" onClick={() => nudge(1)} />
            )}
          </div>

          <div
            className={[
              "search-capsule relative mx-auto w-full max-w-4xl rounded-b-3xl border border-white/60 bg-white p-2",
              // Its own top border is the hairline between the two halves on
              // mobile; on desktop it goes back to the card edge it is.
              "border-t-navy/10 shadow-float-lg md:-mt-4 md:rounded-full md:border-t-white/60",
              "focus-within:ring-2 focus-within:ring-teal-bright focus-within:ring-offset-2 focus-within:ring-offset-transparent",
            ].join(" ")}
          >
            <div className="flex flex-col md:flex-row md:items-stretch">
              <label className="flex flex-1 cursor-text flex-col gap-0.5 rounded-2xl px-4 py-2.5 transition-colors duration-200 hover:bg-navy/[0.03] md:rounded-full md:px-5">
                {/* "Where to?" over a search that only reads trip names is a
                    promise the field can't keep — someone types a district
                    that appears in no title and gets nothing. */}
                <span className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-navy/65">
                  Trip name
                </span>
                <span className="flex items-center gap-2">
                  <input
                    type="search"
                    value={term}
                    onChange={(e) => search(e.target.value)}
                    placeholder="Kodaikanal, Wayanad, Leh…"
                    className="w-full border-0 bg-transparent p-0 text-[0.95rem] text-navy placeholder:text-navy/65 [&::-webkit-search-cancel-button]:hidden"
                  />
                  {term && (
                    <button
                      type="button"
                      onClick={() => { setTerm(""); push({ q: "" }); }}
                      aria-label="Clear search"
                      className="-my-1 grid h-9 w-9 flex-none cursor-pointer place-items-center rounded-full text-navy/55 transition hover:bg-navy/5 hover:text-navy"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </span>
              </label>

              {/* Hairline, not a gap: the two are one question, and a gap
                  would read as two separate controls again. */}
              <span aria-hidden className="mx-4 h-px bg-navy/10 md:mx-0 md:my-2.5 md:h-auto md:w-px" />

              <DateRangeField
                tone="public"
                label="When"
                placeholder="Any dates"
                from={from}
                to={to}
                // Only upcoming trips are listed, so a past date can only ever
                // return nothing. No upper bound — trips are announced months out.
                minDate={new Date()}
                maxDate={null}
                className="rounded-2xl px-4 py-2.5 transition-colors duration-200 hover:bg-navy/[0.03] md:w-[230px] md:rounded-full md:px-5"
                onChange={(range) => push(range)}
              />

              <button
                type="button"
                // Search is live, so this is not what makes it happen — it
                // skips the 300ms debounce for someone who types and then
                // reaches for it.
                onClick={() => push({ q: term })}
                className="mx-1 mb-1 mt-1 inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-teal font-medium text-cream shadow-[0_10px_24px_-10px_rgba(29,138,138,0.9)] transition duration-200 hover:bg-teal-bright active:scale-95 motion-reduce:active:scale-100 md:mx-0 md:mb-0 md:mr-1 md:mt-0 md:h-12 md:w-12 md:flex-none md:self-center"
              >
                <Search className="h-[1.15rem] w-[1.15rem]" aria-hidden />
                <span className="md:sr-only">Search trips</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <div
        aria-busy={pending}
        className={"relative transition-opacity duration-200 " + (pending ? "opacity-50" : "")}
      >
        {pending && (
          <span className="absolute left-1/2 top-16 z-10 inline-flex -translate-x-1/2 items-center gap-2 rounded-full border border-navy/10 bg-white px-4 py-2 text-[0.85rem] font-medium text-navy/70 shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Finding trips…
          </span>
        )}
        {children}
      </div>
    </>
  );
}

/**
 * One end of the category strip.
 *
 * Straddles the card's edge rather than sitting inside its padding. Inside,
 * it ate a tile's worth of the row and still looked like it was resting on
 * the icons; hung on the boundary it reads as a control belonging to the
 * card, and the tiles keep the full width.
 *
 * Desktop only. On a phone the row is swiped, and a 28px target hanging off
 * the card edge would be both hard to hit and the first thing to overflow a
 * 375px screen — the faded end already says there is more.
 */
function ArrowButton({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Scroll categories ${side}`}
      className={[
        "absolute top-[46px] z-20 hidden h-9 w-9 -translate-y-1/2 cursor-pointer place-items-center",
        "rounded-full border border-navy/10 bg-white text-navy/70 shadow-float transition duration-200",
        "hover:border-navy/25 hover:text-navy active:scale-95 motion-reduce:active:scale-100 md:grid",
        side === "left" ? "-left-4" : "-right-4",
      ].join(" ")}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}
