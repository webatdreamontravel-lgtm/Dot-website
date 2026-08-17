import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/sections/Hero";
import { UpcomingTrips } from "@/components/sections/UpcomingTrips";
import { Testimonials } from "@/components/sections/Testimonials";
import { siteConfig } from "@/lib/data/siteConfig";
import { getPublishedReviews } from "@/lib/queries/reviews";
import { getUpcomingTrips } from "@/lib/queries/trips";

// Seat counts change as people book, so this can't be baked at build time —
// a cached "5 seats left" that's really 0 walks customers into a booking
// the server will reject.
export const revalidate = 60;

export default async function HomePage() {
  const [trips, reviews] = await Promise.all([
    getUpcomingTrips(6),
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
        url: `${siteConfig.url}/trips/${trip.slug}`,
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
        <Testimonials reviews={reviews} />
      </main>
      <Footer />
    </>
  );
}
