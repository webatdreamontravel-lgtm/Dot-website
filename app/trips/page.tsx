import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { TripCard } from "@/components/trip/TripCard";
import { AnimatedHeading } from "@/components/shared/AnimatedHeading";
import { tripCategories } from "@/lib/data/siteConfig";
import { getUpcomingTrips } from "@/lib/queries/trips";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "All Upcoming Trips",
  description:
    "Browse all upcoming Dream On Travel community trips — DOT Signatures, Western Ghats escapes, coastal carnivals, abroad voyages and more.",
};

export const revalidate = 60;

export default async function TripsListingPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const all = await getUpcomingTrips();

  // Filtering by label rather than slug because that's what the trip rows
  // store today. Matching is case-insensitive so a stray capital in the
  // admin doesn't silently empty the page.
  const active = tripCategories.find((c) => c.slug === category);
  const trips = active
    ? all.filter((t) => t.category?.toLowerCase() === active.label.toLowerCase())
    : all;

  return (
    <>
      <Navbar variant="solid" />
      <main className="bg-cream pt-32 md:pt-40 pb-24">
        <div className="mx-auto max-w-7xl px-6 md:px-8">
          <p className="font-script text-2xl text-teal">Vaanga, polama →</p>
          <AnimatedHeading as="h1" className="mt-2 text-5xl md:text-8xl">
            All upcoming <span className="italic text-coral">trips</span>
          </AnimatedHeading>
          <p className="mt-6 max-w-xl text-lg text-navy/65">
            Pick a date, pack a bag. We&apos;ve scouted every one of these so you don&apos;t have to.
          </p>

          <div className="mt-10 flex flex-wrap gap-2">
            {[{ slug: "all", label: "All trips", emoji: undefined }, ...tripCategories].map((c) => {
              const isActive = c.slug === "all" ? !active : c.slug === category;
              return (
                <Link
                  key={c.slug}
                  href={c.slug === "all" ? "/trips" : `/trips?category=${c.slug}`}
                  scroll={false}
                  className={cn(
                    "pill border text-xs transition",
                    isActive
                      ? "bg-navy text-cream border-navy"
                      : "bg-cream-soft hover:bg-yellow text-navy border-navy/10",
                  )}
                >
                  {"emoji" in c && c.emoji ? `${c.emoji} ` : ""}
                  {c.label}
                </Link>
              );
            })}
          </div>

          {trips.length === 0 ? (
            <div className="mt-16 rounded-3xl border border-navy/10 bg-cream-soft p-12 text-center">
              <p className="font-display text-2xl text-navy">
                Nothing here just yet
              </p>
              <p className="mt-3 text-navy/60">
                {active
                  ? `No ${active.label} trips are open right now.`
                  : "New trips are announced every few weeks."}
              </p>
              <Link href="/trips" className="btn btn-primary mt-7">
                See all trips
              </Link>
            </div>
          ) : (
            <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
              {trips.map((trip, i) => (
                <TripCard key={trip.slug} trip={trip} index={i} />
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
