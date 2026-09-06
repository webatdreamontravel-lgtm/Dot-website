"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Calendar, Clock, MapPin, Users } from "lucide-react";
import type { TripDetailView } from "@/lib/queries/trips";
import { formatDateRange, formatINR, taxSuffix } from "@/lib/utils";

export function TripHero({ trip }: { trip: TripDetailView }) {
  const slotsLeft = trip.seatsAvailable;
  const isSoldOut = trip.availability === "SOLD_OUT";

  return (
    <section className="relative isolate overflow-hidden text-cream min-h-[90svh] flex flex-col">
      {trip.heroImage && (
        <Image
          src={trip.heroImage}
          alt={trip.title}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/55 to-navy/30" />
      <div className="grain opacity-[0.05]" aria-hidden />

      <div className="relative z-10 flex-1 flex flex-col">
        <div className="h-24 md:h-28" />
        <div className="mx-auto w-full max-w-7xl px-6 md:px-8 flex-1 flex flex-col justify-end pb-14 md:pb-20">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="pill bg-cream/10 text-cream border border-cream/25 backdrop-blur self-start"
          >
            {trip.category}
          </motion.span>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="font-script text-cream/90 text-2xl md:text-3xl mt-5"
          >
            {trip.tagline}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="font-display tracking-tight leading-[0.92] mt-3"
            // Floor lowered from 2.75rem to match the homepage hero: the clamp
            // pinned trip titles to 44px at 375px, and a name like "Mom &
            // Kutties Getaway" then ran to four lines. vw term and desktop
            // ceiling untouched.
            style={{ fontSize: "clamp(2.25rem, 8vw, 6.5rem)" }}
          >
            {trip.title}
          </motion.h1>

          <motion.dl
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="mt-8 grid grid-cols-2 md:grid-cols-5 gap-x-8 gap-y-5"
          >
            <Stat icon={Calendar} label="When" value={formatDateRange(trip.startDate, trip.endDate)} />
            <Stat icon={Clock} label="Duration" value={trip.durationLabel ?? "—"} />
            <Stat icon={MapPin} label="Starting" value={trip.startingFrom ?? "—"} />
            <Stat icon={Users} label="Slots left" value={`${slotsLeft} / ${trip.seatsTotal}`} />
            <Stat
              label="Starting from"
              value={`${formatINR(trip.fromPrice)}`}
              extra={taxSuffix(trip.gstPercent, trip.tcsPercent)}
              big
            />
          </motion.dl>

          {/*
            The one thing this page is for, reachable without reading it.

            The offer used to live only at the very bottom, so someone who had
            already decided — most people arriving from WhatsApp have — had to
            scroll the whole itinerary to act on it. The sticky bar doesn't
            help above the fold either: it only appears after 600px, which is
            roughly where this hero ends.
          */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="mt-9"
          >
            {isSoldOut ? (
              <span className="btn bg-cream/15 text-cream/60 border border-cream/20">
                Sold out
              </span>
            ) : (
              <Link href={`/trips/${trip.slug}/book`} className="btn btn-yellow">
                Book now <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  extra,
  big,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  extra?: string;
  big?: boolean;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-cream/55">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </dt>
      <dd className={big ? "mt-1 font-display text-3xl md:text-4xl" : "mt-1 font-medium text-base md:text-lg"}>
        {value}
        {extra && <span className="text-sm font-sans text-cream/60 ml-1">{extra}</span>}
      </dd>
    </div>
  );
}
