import { AnimatedHeading } from "@/components/shared/AnimatedHeading";
import { Stars } from "@/components/shared/Stars";
import type { TripReview } from "@/lib/queries/trips";
import { cn } from "@/lib/utils";

/**
 * Reviews for a single trip — at most three of them.
 *
 * The layout changes with the count on purpose. A three-column grid holding
 * one review reads as a page that failed to load the other two; the same
 * quote given the full width and centred reads as a chosen pull-quote. So
 * one review becomes an editorial moment and two or three become cards.
 */
export function TripReviews({ reviews }: { reviews: TripReview[] }) {
  if (reviews.length === 0) return null;

  const solo = reviews.length === 1;

  return (
    <section className="bg-cream-soft py-24 md:py-28">
      <div
        className={cn(
          "mx-auto px-4 md:px-8",
          solo ? "max-w-3xl text-center" : "max-w-5xl",
        )}
      >
        <p className="font-script text-2xl text-teal">From this trip</p>
        <AnimatedHeading className="mt-1 mb-12 text-5xl md:text-6xl">
          {solo ? "What a traveller " : "What travellers "}
          <span className="italic text-coral">said</span>
        </AnimatedHeading>

        {solo ? <SoloReview review={reviews[0]} /> : <ReviewGrid reviews={reviews} />}
      </div>
    </section>
  );
}

/**
 * No card, no border. With nothing else competing for the space, chrome only
 * makes the quote look smaller than the room it has been given.
 */
function SoloReview({ review }: { review: TripReview }) {
  return (
    <figure>
      {/* The quote marks are real punctuation on the same serif as the words
          they wrap, just tinted. A free-floating decorative glyph collides
          with the first line at every text length that isn't the one you
          designed against. */}
      <blockquote className="font-display text-[1.75rem] leading-[1.2] tracking-tight text-balance text-navy md:text-[2.75rem]">
        <span className="text-yellow">&ldquo;</span>
        {review.body}
        <span className="text-yellow">&rdquo;</span>
      </blockquote>

      <figcaption className="mt-9 flex flex-col items-center gap-2.5">
        <Stars rating={review.rating} size="lg" className="justify-center" />
        <div>
          <p className="font-medium leading-tight text-navy">{review.authorName}</p>
          {review.tripTitle && (
            <p className="mt-0.5 text-sm text-navy/55">{review.tripTitle}</p>
          )}
        </div>
      </figcaption>
    </figure>
  );
}

/** A rotating accent keeps two or three identical cards from reading as one block. */
const ACCENTS = [
  { rule: "bg-yellow", mark: "text-yellow" },
  { rule: "bg-teal", mark: "text-teal" },
  { rule: "bg-coral", mark: "text-coral" },
];

function ReviewGrid({ reviews }: { reviews: TripReview[] }) {
  return (
    <div
      className={cn(
        "grid gap-5",
        // Two reviews stay narrow so they don't stretch into letterboxes.
        reviews.length === 2 ? "mx-auto max-w-3xl sm:grid-cols-2" : "md:grid-cols-3",
      )}
    >
      {reviews.map((r, i) => {
        const accent = ACCENTS[i % ACCENTS.length];
        return (
          <figure
            key={i}
            className="relative flex flex-col overflow-hidden rounded-3xl border border-navy/8 bg-cream p-7 shadow-sm"
          >
            <span aria-hidden className={cn("absolute inset-x-0 top-0 h-[3px]", accent.rule)} />

            <blockquote className="flex-1 font-display text-lg leading-snug tracking-tight text-navy md:text-xl">
              <span className={accent.mark}>&ldquo;</span>
              {r.body}
              <span className={accent.mark}>&rdquo;</span>
            </blockquote>

            <figcaption className="mt-6 border-t border-navy/8 pt-4">
              <Stars rating={r.rating} className="mb-2" />
              <p className="font-medium leading-tight text-navy">{r.authorName}</p>
              {r.tripTitle && <p className="text-sm text-navy/55">{r.tripTitle}</p>}
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

