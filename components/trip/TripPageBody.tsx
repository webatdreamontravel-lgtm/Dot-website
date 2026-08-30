import * as Accordion from "@radix-ui/react-accordion";
import { Check, ChevronDown, X } from "lucide-react";

import { TripHero } from "@/components/trip/TripHero";
import { StickyTripBar } from "@/components/trip/StickyTripBar";
import { ItineraryAccordion } from "@/components/trip/ItineraryAccordion";
import { PricingTable } from "@/components/trip/PricingTable";
import { Moodboard } from "@/components/trip/Moodboard";
import { TripReviews } from "@/components/trip/TripReviews";
import { AnimatedHeading } from "@/components/shared/AnimatedHeading";
import { RichText, isEmptyDoc } from "@/components/content/RichText";
import { siteConfig } from "@/lib/data/siteConfig";
import type { TripDetailView } from "@/lib/queries/trips";
import { formatINR } from "@/lib/utils";

/**
 * The entire trip page below the nav.
 *
 * Shared by the public route and the admin draft preview so a preview can
 * never drift from the real thing — the whole point of previewing is to see
 * exactly what will ship.
 */
export function TripPageBody({ trip }: { trip: TripDetailView }) {
  const isSoldOut = trip.availability === "SOLD_OUT";
  // Falls back to the full price when no advance is configured — a trip with
  // no advance is simply paid in full at booking.
  const payNow = trip.advance ?? trip.fromPrice;

  return (
    <>
      <TripHero trip={trip} />
      <StickyTripBar trip={trip} />

      {(!isEmptyDoc(trip.introduction) || trip.moodboard.length > 0) && (
        <section className="bg-cream py-16 md:py-24">
          {/* Stacked, not side by side — the lede reads better with the full
              measure and the moodboard gets room to breathe underneath. */}
          <div className="mx-auto flex max-w-3xl flex-col gap-10 px-4 md:px-8">
            {!isEmptyDoc(trip.introduction) && (
              <div>
                <p className="font-script text-2xl text-coral mb-3">The vibe →</p>
                {/* Back to the original display scale — it was the loose
                    1.75 line-height that made it sprawl, not the type size. */}
                <RichText
                  doc={trip.introduction}
                  className="font-display text-2xl md:text-3xl tracking-tight text-navy [&_p]:text-navy [&_p]:leading-[1.35] [&_p]:mb-5"
                />
              </div>
            )}

            {trip.moodboard.length > 0 && (
              <Moodboard entries={trip.moodboard} />
            )}
          </div>
        </section>
      )}

      {trip.itinerary.length > 0 && (
        <section className="bg-cream-soft py-24 md:py-32">
          <div className="mx-auto max-w-5xl px-4 md:px-8">
            <p className="font-script text-2xl text-coral">Day by day →</p>
            <AnimatedHeading className="mt-1 text-5xl md:text-7xl mb-12">
              The <span className="italic text-teal">itinerary</span>
            </AnimatedHeading>
            <ItineraryAccordion days={trip.itinerary} />
          </div>
        </section>
      )}

      {(!isEmptyDoc(trip.inclusions) || !isEmptyDoc(trip.exclusions)) && (
        <section className="bg-cream py-24 md:py-28">
          <div className="mx-auto max-w-5xl px-4 md:px-8">
            <AnimatedHeading className="text-5xl md:text-6xl mb-10">
              What&apos;s in, what&apos;s <span className="italic">out</span>
            </AnimatedHeading>
            <div className="grid gap-5 md:grid-cols-2">
              {!isEmptyDoc(trip.inclusions) && (
                <div className="rounded-3xl border border-teal/20 bg-teal/[0.06] p-7 md:p-8">
                  <h3 className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-teal">
                    <Check className="h-4 w-4" /> Inclusions
                  </h3>
                  <RichText doc={trip.inclusions} />
                </div>
              )}
              {!isEmptyDoc(trip.exclusions) && (
                <div className="rounded-3xl border border-coral/20 bg-coral/[0.06] p-7 md:p-8">
                  <h3 className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-coral">
                    <X className="h-4 w-4" /> Exclusions
                  </h3>
                  <RichText doc={trip.exclusions} className="[&_li>span]:bg-coral" />
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {!isEmptyDoc(trip.thingsToKnow) && (
        <section className="bg-cream-soft py-24 md:py-28">
          <div className="mx-auto max-w-4xl px-4 md:px-8">
            <AnimatedHeading className="text-5xl md:text-6xl mb-10">
              Things to <span className="italic text-teal">know</span>
            </AnimatedHeading>
            <RichText doc={trip.thingsToKnow} />
          </div>
        </section>
      )}

      {trip.pricingTiers.length > 0 && (
        <section className="bg-cream py-24 md:py-28">
          <div className="mx-auto max-w-5xl px-4 md:px-8">
            <p className="font-script text-2xl text-coral">The numbers</p>
            <AnimatedHeading className="mt-1 text-5xl md:text-6xl mb-10">Pricing</AnimatedHeading>
            <PricingTable tiers={trip.pricingTiers} gst={trip.gstPercent} tcs={trip.tcsPercent} />
          </div>
        </section>
      )}

      <TripReviews reviews={trip.reviews} />

      <section id="book" className="bg-navy text-cream py-24 md:py-32 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute -top-20 left-1/2 -translate-x-1/2 h-[480px] w-[480px] rounded-full bg-yellow/15 blur-[140px]"
        />
        <div className="grain opacity-[0.05]" aria-hidden />
        <div className="relative mx-auto max-w-3xl px-4 md:px-8 text-center">
          <p className="font-script text-2xl text-yellow">Lock your slot</p>
          <AnimatedHeading className="mt-2 text-5xl md:text-7xl">
            {trip.advance ? (
              <>
                Pay {formatINR(payNow)} <span className="italic">advance</span>
                <br />
                to confirm your spot.
              </>
            ) : (
              <>
                Book your <span className="italic">spot</span>.
              </>
            )}
          </AnimatedHeading>

          {!isSoldOut && trip.showSeatsLeft && (
            <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-yellow/30 bg-yellow/10 px-4 py-2 text-sm font-semibold text-yellow">
              <span className="pulse-dot" />
              {/* "Only 20 of 20 seats left" on a batch nobody has booked is
                  both nonsense and false urgency. State the size instead, and
                  save the scarcity wording for when it's earned. */}
              {trip.seatsAvailable >= trip.seatsTotal
                ? `${trip.seatsTotal} seats on this departure`
                : `Only ${trip.seatsAvailable} of ${trip.seatsTotal} seats left`}
            </p>
          )}

          <p className="mt-6 text-cream/70 max-w-xl mx-auto leading-relaxed">
            Slots are first-come-first-serve. We&apos;ll add you to the private trip
            WhatsApp group once you&apos;re confirmed.
          </p>

          {trip.tcsPercent > 0 && (
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-cream/55">
              {formatINR(trip.fromPrice)} + {trip.gstPercent}% GST + {trip.tcsPercent}% TCS
              {" = "}
              <b className="text-cream/80">
                {formatINR(
                  trip.fromPrice +
                    Math.round(trip.fromPrice * (trip.gstPercent / 100)) +
                    Math.round(trip.fromPrice * (trip.tcsPercent / 100)),
                )}
              </b>{" "}
              per person. TCS is a government levy on overseas packages and is
              claimable against your income tax.
            </p>
          )}

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            {isSoldOut ? (
              <a href={siteConfig.whatsappUrl} target="_blank" rel="noreferrer" className="btn btn-yellow">
                Sold out — join the waitlist
              </a>
            ) : (
              <a href={`/trips/${trip.slug}/book`} className="btn btn-yellow">
                {trip.advance ? `Pay ${formatINR(payNow)} & book` : "Book your seat"}
              </a>
            )}
            <a href={siteConfig.whatsappUrl} target="_blank" rel="noreferrer" className="btn btn-ghost">
              Talk to us first
            </a>
          </div>
        </div>
      </section>

      {!isEmptyDoc(trip.cancellationPolicy) && (
        <section className="bg-cream py-20">
          <div className="mx-auto max-w-3xl px-4 md:px-8">
            <Accordion.Root type="single" collapsible>
              <Accordion.Item
                value="cancellation"
                className="rounded-2xl border border-navy/10 bg-cream-soft overflow-hidden"
              >
                <Accordion.Header>
                  <Accordion.Trigger className="group w-full flex items-center justify-between p-6 text-left">
                    <span className="font-display text-xl md:text-2xl">Cancellation policy</span>
                    <ChevronDown className="h-5 w-5 transition-transform group-data-[state=open]:rotate-180" />
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content className="overflow-hidden data-[state=open]:animate-[accordionDown_0.3s_ease-out] data-[state=closed]:animate-[accordionUp_0.3s_ease-out]">
                  <div className="px-6 pb-6">
                    <RichText doc={trip.cancellationPolicy} />
                    <p className="mt-4 text-sm text-navy/60">
                      Read the full policy{" "}
                      <a
                        href="/cancellation-and-refund-policy"
                        className="underline underline-offset-4 text-teal"
                      >
                        here
                      </a>
                      .
                    </p>
                  </div>
                </Accordion.Content>
              </Accordion.Item>
            </Accordion.Root>
          </div>
        </section>
      )}
    </>
  );
}
