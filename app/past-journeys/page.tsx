import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { AnimatedHeading } from "@/components/shared/AnimatedHeading";
import { PastTripGrid } from "@/components/shared/PastTripGrid";
import { stats } from "@/lib/data/pastTrips";

export const metadata: Metadata = {
  title: "Past Journeys",
  description:
    "30+ trips, 200+ travelers, endless laughter. A look back at every Dream On Travel community trip we've run since 2023.",
};

export default function PastJourneysPage() {
  return (
    <>
      <Navbar variant="solid" />
      <main className="bg-cream pt-32 md:pt-40 pb-24">
        <div className="mx-auto max-w-7xl px-6 md:px-8">
          <p className="font-script text-2xl text-coral">Memories on rewind →</p>
          <AnimatedHeading as="h1" className="mt-2 text-5xl md:text-8xl">
            Pages from our <span className="italic text-teal">journey</span>
          </AnimatedHeading>
          <p className="mt-6 max-w-2xl text-lg text-navy/65">
            Every trip is its own little universe. Here are some of the ones our community has lived through.
          </p>

          <dl className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl bg-cream-soft border border-navy/10 px-5 py-6 text-center"
              >
                <dt className="text-xs uppercase tracking-[0.18em] text-navy/55">{s.label}</dt>
                <dd className="mt-1 font-display text-3xl md:text-4xl">{s.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-14">
            <PastTripGrid />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
