import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/sections/Hero";
import { UpcomingTrips } from "@/components/sections/UpcomingTrips";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Testimonials } from "@/components/sections/Testimonials";
import { siteUrl } from "@/lib/siteUrl";
import { getPublishedReviews } from "@/lib/queries/reviews";
import { getUpcomingTrips } from "@/lib/queries/trips";

/**
 * Rendered per request, deliberately not cached.
 *
 * `revalidate = 60` already had the right reason written against it — seat
 * counts change as people book, and a cached "5 seats left" that is really 0
 * walks someone into a booking the server will reject — but a 60-second
 * window is still a window, and the first request after it expires is served
 * the stale copy anyway.
 *
 * Which trip leads the rail is now editorial too: turning on the big card
 * demotes whichever trip held it, and both pages should agree about that the
 * moment it is saved rather than up to a minute later.
 *
 * Matches /trips and /trips/[slug], which were moved off the timer for the
 * same reason. The cost is a trips query, a seat-count call and the reviews
 * read per view — all indexed.
 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [trips, reviews] = await Promise.all([
    // Homepage rail only — a trip can be live and bookable at /trips
    // without leading the front page.
    getUpcomingTrips(6, { homepageOnly: true }),
    getPublishedReviews(3),
  ]);

  const tripJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Upcoming trips by Dream On Travel",
    itemListElement: trips.map((trip, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "TouristTrip",
        name: trip.title,
        description: trip.tagline ?? undefined,
        url: `${siteUrl()}/trips/${trip.slug}`,
        image: trip.heroImage ?? undefined,
        touristType: "Group travel",
      },
    })),
  };

  return (
    <>
      <Navbar />
      <main>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(tripJsonLd) }}
        />
        <Hero />
        <UpcomingTrips trips={trips} />
        <HowItWorks />
        <Testimonials reviews={reviews} />
      </main>
      <Footer />
    </>
  );
}
