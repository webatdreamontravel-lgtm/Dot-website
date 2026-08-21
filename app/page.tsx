import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/sections/Hero";
import { UpcomingTrips } from "@/components/sections/UpcomingTrips";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Testimonials } from "@/components/sections/Testimonials";
import { siteUrl } from "@/lib/siteUrl";
import { getPublishedReviews } from "@/lib/queries/reviews";
import { getUpcomingTrips } from "@/lib/queries/trips";
import { legalConfig, siteConfig } from "@/lib/data/siteConfig";

// Seat counts change as people book, so this can't be baked at build time —
// a cached "5 seats left" that's really 0 walks customers into a booking
// the server will reject.
export const revalidate = 60;

export default async function HomePage() {
  const [trips, reviews] = await Promise.all([
    getUpcomingTrips(6),
    getPublishedReviews(3),
  ]);

  // Who the business actually is, in the format aggregators and search
  // engines read. Kept beside the trip list rather than in the root layout:
  // repeating an Organization block on every page is noise, and the home
  // page is the one canonically "about" the company.
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    name: siteConfig.name,
    legalName: legalConfig.registeredName,
    description: siteConfig.description,
    url: siteUrl(),
    email: siteConfig.email,
    telephone: siteConfig.phone,
    foundingDate: String(siteConfig.established),
    priceRange: "₹₹",
    address: {
      "@type": "PostalAddress",
      streetAddress: legalConfig.addressLines.join(", "),
      addressLocality: siteConfig.address.city,
      addressRegion: siteConfig.address.state,
      postalCode: siteConfig.address.pincode,
      addressCountry: "IN",
    },
    sameAs: [siteConfig.instagram],
    ...(legalConfig.gstin ? { taxID: legalConfig.gstin } : {}),
  };

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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
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
