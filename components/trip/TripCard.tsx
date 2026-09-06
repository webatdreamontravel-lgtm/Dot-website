"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Calendar, Clock } from "lucide-react";
import type { Availability, TripCardView } from "@/lib/queries/trips";
import { cn, formatDateRange, formatINR, taxSuffix } from "@/lib/utils";

const STATUS_STYLES: Record<Availability, { label: string; className: string; pulse: boolean }> = {
  FAST_FILLING: { label: "Fast filling", className: "bg-yellow text-navy", pulse: true },
  FEW_SLOTS_LEFT: { label: "Few slots left", className: "bg-teal text-cream", pulse: true },
  SOLD_OUT: { label: "Sold out", className: "bg-coral text-cream", pulse: false },
  OPEN: { label: "Booking open", className: "bg-cream text-navy", pulse: false },
};

type TripCardProps = {
  trip: TripCardView;
  featured?: boolean;
  index?: number;
};

export function TripCard({ trip, featured = false, index = 0 }: TripCardProps) {
  const status = STATUS_STYLES[trip.availability];
  const soldOut = trip.availability === "SOLD_OUT";
  const filled = trip.seatsTotal > 0
    ? Math.round(((trip.seatsTotal - trip.seatsAvailable) / trip.seatsTotal) * 100)
    : 0;

  return (
    <motion.article
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ duration: 0.7, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -8 }}
      className={cn(
        "group relative overflow-hidden rounded-3xl bg-navy text-cream",
        featured
          ? "md:col-span-2 md:row-span-2 aspect-[16/11] md:aspect-auto md:min-h-[640px]"
          : "aspect-[5/6]",
      )}
      data-cursor-hover
    >
      <Link
        href={`/trips/${trip.slug}`}
        aria-label={`View ${trip.title} trip details`}
        className="absolute inset-0 z-20"
      />

      {trip.cardImage && (
        <Image
          src={trip.cardImage}
          alt={trip.title}
          fill
          sizes={featured ? "(min-width: 768px) 66vw, 100vw" : "(min-width: 768px) 33vw, 100vw"}
          className={cn(
            "object-cover transition-transform duration-700 group-hover:scale-[1.06]",
            soldOut && "grayscale-[0.45]",
          )}
          priority={featured && index === 0}
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-br from-navy/20 to-transparent" />

      <div className="absolute top-5 left-5 z-10">
        <span className={cn("pill text-[0.75rem] font-semibold", status.className)}>
          {status.pulse && <span className="pulse-dot" />}
          {status.label}
        </span>
      </div>

      {trip.category && (
        <div className="absolute top-5 right-5 z-10">
          <span className="pill bg-cream/10 backdrop-blur text-cream/85 text-[0.75rem] border border-cream/20">
            {trip.category}
          </span>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 z-10 p-6 md:p-8">
        <h3
          className={cn(
            "font-display tracking-tight leading-[0.95] mb-3",
            featured ? "text-3xl md:text-6xl" : "text-3xl md:text-4xl",
          )}
        >
          {trip.title}
        </h3>
        {featured && trip.tagline && (
          <p className="text-cream/75 max-w-md text-base md:text-lg leading-snug">
            {trip.tagline}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-cream/80">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {formatDateRange(trip.startDate, trip.endDate)}
          </span>
          {trip.durationLabel && (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {trip.durationLabel}
            </span>
          )}
        </div>

        {/* Seat urgency. Hidden when the trip opts out, and never shown for
            a sold-out trip where the badge already says it. */}
        {trip.showSeatsLeft && !soldOut && (
          <div className="mt-4">
            <div className="h-1 w-full overflow-hidden rounded-full bg-cream/20">
              <div
                className="h-full rounded-full bg-yellow transition-[width] duration-700"
                style={{ width: `${Math.min(filled, 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-cream/75">
              <b className="text-yellow">
                {trip.seatsAvailable >= trip.seatsTotal
                  ? `${trip.seatsTotal} seats`
                  : `${trip.seatsAvailable} of ${trip.seatsTotal} seats left`}
              </b>
            </p>
          </div>
        )}

        <div className="mt-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-cream/55">
              From
              {trip.offerLabel && (
                <span className="ml-2 rounded-full bg-coral px-2 py-0.5 text-[0.75rem] font-bold tracking-wider text-white">
                  {trip.offerLabel}
                </span>
              )}
            </p>
            <p className="font-display text-2xl md:text-3xl">
              {trip.comparePrice && (
                <s className="mr-1.5 text-lg text-cream/45">{formatINR(trip.comparePrice)}</s>
              )}
              {formatINR(trip.fromPrice)}
              <span className="text-sm font-sans text-cream/60"> {taxSuffix(trip.gstPercent, trip.tcsPercent)}</span>
            </p>
          </div>
          <div className="h-11 w-11 rounded-full bg-cream/10 backdrop-blur flex items-center justify-center transition-all group-hover:bg-yellow group-hover:text-navy">
            <ArrowUpRight className="h-5 w-5 transition-transform group-hover:rotate-12" />
          </div>
        </div>
      </div>
    </motion.article>
  );
}
