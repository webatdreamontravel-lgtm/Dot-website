import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock, ShieldCheck } from "lucide-react";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { getSessionProfile } from "@/lib/auth";
import { getBookableTrip, type BookableTrip } from "@/lib/queries/booking";
import { computePricing, toRupees } from "@/lib/booking/pricing";
import { formatINR } from "@/lib/utils";
import { paymentsConfig, siteConfig } from "@/lib/data/siteConfig";
import { BookingForm } from "./BookingForm";

type Params = { params: Promise<{ slug: string }> };

export const metadata: Metadata = { title: "Book your seat", robots: { index: false } };

export default async function BookTripPage({ params }: Params) {
  const { slug } = await params;

  // Deliberately NOT requireUser. Sending a signed-out visitor straight to a
  // login screen means the one thing they came here to find out — what this
  // actually costs, all in — is hidden behind an account they haven't decided
  // to create yet. It also means a payment-gateway reviewer auditing the site
  // hits a wall where the purchase journey should be. So: price first,
  // account only at the point it's genuinely needed.
  const profile = await getSessionProfile();

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

          <h1 className="mt-3 font-display text-3xl tracking-tight text-navy md:text-5xl">
            Book your seat
          </h1>
          <p className="mt-1.5 text-navy/60">
            {trip.title}
          </p>

          {trip.seatsAvailable === 0 ? (
            <SoldOut whatsapp={siteConfig.whatsappUrl} />
          ) : profile ? (
            <BookingForm
              trip={trip}
              customer={{
                fullName: profile.fullName,
                email: profile.email,
                phone: profile.phone,
              }}
            />
          ) : (
            <SignedOutPreview trip={trip} />
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

/**
 * What a visitor sees before signing in: what a seat costs, then the account
 * step.
 *
 * One figure, all in — not the tax breakdown. The breakdown is on the next
 * screen, where it belongs: it answers "how is this made up", a question
 * nobody has before they have decided the price is acceptable at all. Three
 * rows of tax arithmetic in front of someone still deciding whether to make
 * an account is arithmetic they did not ask for.
 *
 * What does NOT move is the total. ₹10,700 is on this screen, before the
 * account, because the surprise that loses a booking is discovering the tax
 * after signing up — and that surprise comes from the TOTAL being hidden,
 * not from GST and TCS being on one line instead of three.
 */
function SignedOutPreview({ trip }: { trip: BookableTrip }) {
  const price = computePricing(trip, 1);
  const signInHref = `/login?next=${encodeURIComponent(`/trips/${trip.slug}/book`)}`;
  const signUpHref = `/signup?next=${encodeURIComponent(`/trips/${trip.slug}/book`)}`;

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
      <section className="rounded-3xl border border-navy/10 bg-white p-6 md:p-8">
        <h2 className="font-display text-2xl tracking-tight text-navy">What a seat costs</h2>
        <p className="mt-1.5 text-[0.92rem] leading-relaxed text-navy/60">
          Per traveller, all inclusive of taxes. Add more travellers on the next step — the
          total updates as you go.
        </p>

        <dl className="mt-6 border-y border-navy/10">
          <div className="flex items-baseline justify-between gap-4 py-4">
            <div>
              <dt className="font-medium text-navy">Total per traveller</dt>
              {/* The components named, not priced. Someone who wants the
                  split gets it on the next screen; someone who doesn't
                  still learns there is nothing else to come. */}
              <p className="mt-0.5 text-[0.85rem] text-navy/55">
                Trip fare + GST{price.tcsPercent > 0 ? " + TCS" : ""}
              </p>
            </div>
            <dd className="font-display text-2xl tabular-nums text-navy">
              {formatINR(toRupees(price.totalPaise))}
            </dd>
          </div>
        </dl>

        {price.advanceDuePaise > 0 ? (
          <p className="mt-5 rounded-2xl bg-teal/[0.07] px-4 py-3 text-[0.9rem] leading-relaxed text-navy/75">
            {/* trip.razorpayEnabled, not paymentsConfig.gatewayLive.
                gatewayLive is a site-wide flag about the business and is still
                false, while these trips have Razorpay switched ON — so this
                read "nothing is charged on this site" one click away from a
                Razorpay popup. The flag that decides what happens to THIS
                booking is the one on the trip. */}
            <strong className="text-navy">
              {trip.razorpayEnabled
                ? `Pay ${formatINR(toRupees(price.advanceDuePaise))} now`
                : `An advance of ${formatINR(toRupees(price.advanceDuePaise))} confirms your seat`}
            </strong>{" "}
            {trip.razorpayEnabled
              ? "at checkout to confirm your seat."
              : "— the team will collect it directly once you book; nothing is charged on this site."}{" "}
            The balance of {formatINR(toRupees(price.balancePaise))}{" "}
            is due before departure — we&apos;ll tell you the exact date when you book.
          </p>
        ) : (
          <p className="mt-5 rounded-2xl bg-teal/[0.07] px-4 py-3 text-[0.9rem] leading-relaxed text-navy/75">
            {/* No advance on this trip, so the whole amount falls due at once —
                which on a Razorpay-enabled trip is collected at checkout.
                "Nothing is charged online" is untrue there, so this branches
                on the trip the way the checkout button does. */}
            {trip.razorpayEnabled ? (
              <>
                <strong className="text-navy">
                  Pay {formatINR(toRupees(price.totalPaise))} now
                </strong>{" "}
                to confirm your seat. Payment is taken at checkout, and your seat is
                confirmed as soon as it goes through.
              </>
            ) : (
              <>
                <strong className="text-navy">Nothing is charged online.</strong> Book your
                seat and our team calls you within one working day to confirm the trip and
                arrange payment.
              </>
            )}
          </p>
        )}

        <p className="mt-5 text-[0.85rem] leading-relaxed text-navy/55">
          Cancelling is covered by our{" "}
          <Link href="/cancellation-and-refund-policy" className="text-teal underline underline-offset-4">
            refund policy
          </Link>
          . Full breakdown of what is and isn&apos;t included is on the{" "}
          <Link href={`/trips/${trip.slug}`} className="text-teal underline underline-offset-4">
            trip page
          </Link>
          .
        </p>
      </section>

      <aside className="lg:sticky lg:top-28 self-start rounded-3xl border border-navy/10 bg-navy p-6 text-cream">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-cream/10">
          <Lock className="h-4 w-4" aria-hidden />
        </span>
        <h2 className="mt-4 font-display text-2xl tracking-tight">One step left</h2>
        <p className="mt-2 text-[0.9rem] leading-relaxed text-cream/70">
          We need an account before we can hold a seat — it&apos;s where your booking,
          traveller details and trip updates live.
        </p>

        <Link href={signUpHref} className="btn btn-yellow mt-5 w-full justify-center">
          Create an account
        </Link>
        <Link
          href={signInHref}
          className="mt-2.5 block rounded-full border border-cream/25 px-4 py-2.5 text-center text-[0.9rem] font-medium transition hover:bg-cream/10"
        >
          I already have one
        </Link>

        <p className="mt-5 flex items-start gap-2 text-[0.8rem] leading-relaxed text-cream/55">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden />
          {trip.razorpayEnabled
            ? `Payments are processed by ${paymentsConfig.gatewayName}. We never see or store your card details.`
            : "No card or bank details are collected on this site. The team arranges payment with you directly."}
        </p>

        <hr className="my-5 border-cream/15" />
        <p className="text-[0.85rem] leading-relaxed text-cream/70">
          Prefer to talk to a human first?{" "}
          <a
            href={siteConfig.whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-yellow underline underline-offset-4"
          >
            WhatsApp us
          </a>{" "}
          and we&apos;ll walk you through it.
        </p>
      </aside>
    </div>
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
