import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { TripPageBody } from "@/components/trip/TripPageBody";
import { siteConfig } from "@/lib/data/siteConfig";
import { getPublishedTripSlugs, getTripBySlug } from "@/lib/queries/trips";

type Params = { params: Promise<{ slug: string }> };

export const revalidate = 60;

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
