"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { TripCardView } from "@/lib/queries/trips";
import { TripCard } from "@/components/trip/TripCard";
import { AnimatedHeading } from "@/components/shared/AnimatedHeading";

export function UpcomingTrips({ trips }: { trips: TripCardView[] }) {
  // Data comes from the server component above; this stays a client
  // component only for the scroll animations.
  if (trips.length === 0) return null;

  // Only an explicitly featured trip gets the large card. Previously this
  // took trips[0], so whichever trip happened to sort first was rendered as
  // featured even with the toggle off.
  const featured = trips.find((t) => t.isFeatured) ?? null;
  const rest = trips.filter((t) => t.slug !== featured?.slug).slice(0, featured ? 3 : 6);

  return (
    <section
      id="trips"
      aria-label="Upcoming Trips"
      className="relative bg-cream text-navy py-24 md:py-32"
    >
      <div className="mx-auto max-w-7xl px-6 md:px-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12 md:mb-16">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="font-script text-2xl text-teal"
            >
              Pick your story →
            </motion.p>
            <AnimatedHeading
              as="h2"
              className="mt-2 text-5xl md:text-7xl"
            >
              Where we&apos;re <span className="italic text-teal">heading</span> next
            </AnimatedHeading>
          </div>
          <Link
            href="/trips"
            className="hidden md:inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4 hover:text-teal transition"
          >
            View all upcoming trips
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
          {featured && <TripCard trip={featured} featured index={0} />}
          {rest.map((trip, i) => (
            <TripCard trip={trip} key={trip.slug} index={featured ? i + 1 : i} />
          ))}
        </div>

        <div className="mt-10 md:hidden flex justify-center">
          <Link href="/trips" className="btn btn-primary">
            View all trips
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
