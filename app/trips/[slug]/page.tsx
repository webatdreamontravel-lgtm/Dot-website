import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { TripPageBody } from "@/components/trip/TripPageBody";
import { siteConfig } from "@/lib/data/siteConfig";
import { getPublishedTripSlugs, getTripBySlug } from "@/lib/queries/trips";

type Params = { params: Promise<{ slug: string }> };

/**
 * Rendered per request, deliberately not cached.
 *
 * This page prints a live seat count — "Slots left 1 / 6" in the hero, "Only
 * 1 of 6 seats left" in the body — and it is the page people book from. With
 * `revalidate = 60` that number came out of the cache, so the trip could
 * advertise one seat while /book, which is dynamic and reads the seat
 * function per request, correctly offered two. The two screens disagreeing
 * about the last seat is worse than the query it saves: a trip row and one
 * call to trip_seats_available(), both indexed.
 *
 * If this page ever needs caching back, the seat count has to come out of the
 * cached tree first — a Suspense boundary around the live number — not by
 * putting the whole page back on a timer.
 */
export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  return (await getPublishedTripSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const trip = await getTripBySlug(slug);
  if (!trip) return { title: "Trip not found" };

  const description = trip.tagline ?? undefined;
  const images = trip.heroImage
    ? [{ url: trip.heroImage, width: 1200, height: 630, alt: trip.title }]
    : undefined;

  return {
    title: trip.title,
    description,
    openGraph: { title: trip.title, description, images, type: "article" },
    twitter: {
      card: "summary_large_image",
      title: trip.title,
      description,
      images: trip.heroImage ? [trip.heroImage] : undefined,
    },
  };
}

export default async function TripDetailPage({ params }: Params) {
  const { slug } = await params;
  const trip = await getTripBySlug(slug);
  if (!trip) notFound();

  const tripJsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: trip.title,
    description: trip.tagline ?? undefined,
    image: trip.heroImage ?? undefined,
    url: `${siteConfig.url}/trips/${trip.slug}`,
    touristType: "Group travel",
    offers: {
      "@type": "Offer",
      price: trip.fromPrice,
      priceCurrency: "INR",
      availability:
        trip.availability === "SOLD_OUT"
          ? "https://schema.org/SoldOut"
          : "https://schema.org/InStock",
      validFrom: trip.startDate,
    },
    itinerary: {
      "@type": "ItemList",
      itemListElement: trip.itinerary.map((d, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: d.title,
      })),
    },
    provider: {
      "@type": "TravelAgency",
      name: siteConfig.name,
      url: siteConfig.url,
    },
  };

  return (
    <>
      <Navbar variant="transparent" />
      <main>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(tripJsonLd) }}
        />
        <TripPageBody trip={trip} />
      </main>
      <Footer />
    </>
  );
}
