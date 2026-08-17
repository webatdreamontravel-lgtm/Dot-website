import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { requireUser } from "@/lib/auth";
import { getBookableTrip } from "@/lib/queries/booking";
import { siteConfig } from "@/lib/data/siteConfig";
import { BookingForm } from "./BookingForm";

type Params = { params: Promise<{ slug: string }> };

export const metadata: Metadata = { title: "Book your seat", robots: { index: false } };

export default async function BookTripPage({ params }: Params) {
  const { slug } = await params;

  // Gate first, and send them back here afterwards — a customer who signs in
  // to book should land on the booking form, not the home page.
  const profile = await requireUser(`/trips/${slug}/book`);

  const trip = await getBookableTrip(slug);
  if (!trip) notFound();

  return (
    <>
      <Navbar variant="solid" />
      <main className="min-h-screen bg-cream-soft pb-24 pt-28 md:pt-32">
        <div className="mx-auto max-w-5xl px-4 md:px-8">
          <Link
            href={`/trips/${trip.slug}`}
            className="inline-flex items-center gap-1.5 text-sm text-navy/60 transition hover:text-navy"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to {trip.title}
          </Link>

          <h1 className="mt-3 font-display text-4xl tracking-tight text-navy md:text-5xl">
            Book your seat
          </h1>
          <p className="mt-1.5 text-navy/60">
            {trip.title}
            {trip.batchName && <span className="text-navy/45"> · {trip.batchName}</span>}
          </p>

          {trip.seatsAvailable === 0 ? (
            <SoldOut whatsapp={siteConfig.whatsappUrl} />
          ) : (
            <BookingForm
              trip={trip}
              customer={{
                fullName: profile.fullName,
                email: profile.email,
                phone: profile.phone,
              }}
            />
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

function SoldOut({ whatsapp }: { whatsapp: string }) {
  return (
    <div className="mt-8 rounded-3xl border border-coral/25 bg-coral/[0.06] p-8 text-center">
      <p className="font-display text-2xl text-navy">This batch is full.</p>
      <p className="mx-auto mt-2 max-w-md text-navy/65">
        Every seat has gone. Message us and we&apos;ll add you to the waitlist — cancellations
        do happen, and the next batch usually opens soon after.
      </p>
      <a
        href={whatsapp}
        target="_blank"
        rel="noreferrer"
        className="btn btn-yellow mt-6 inline-flex"
      >
        Join the waitlist
      </a>
    </div>
  );
}
