import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, MessageCircle } from "lucide-react";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { requireUser } from "@/lib/auth";
import { toRupees } from "@/lib/booking/pricing";
import { getBookingForCustomer } from "@/lib/queries/booking";
import { siteConfig } from "@/lib/data/siteConfig";
import { formatDateRange, formatINR } from "@/lib/utils";

type Params = {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ new?: string }>;
};

export const metadata: Metadata = { title: "Your booking", robots: { index: false } };

const STATUS_COPY: Record<string, { label: string; tone: string; body: string }> = {
  REQUESTED: {
    label: "Request received",
    tone: "bg-yellow text-navy",
    body: "Your seats are held. Our team will contact you to arrange payment and confirm.",
  },
  PENDING_PAYMENT: {
    label: "Awaiting payment",
    tone: "bg-yellow text-navy",
    body: "Your seats are held until payment comes through.",
  },
  CONFIRMED: {
    label: "Confirmed",
    tone: "bg-teal text-cream",
    body: "You're in. We'll add you to the trip WhatsApp group before departure.",
  },
  CANCELLED: { label: "Cancelled", tone: "bg-coral text-cream", body: "This booking was cancelled." },
  REFUNDED: { label: "Refunded", tone: "bg-navy/10 text-navy", body: "This booking was refunded." },
  EXPIRED: {
    label: "Expired",
    tone: "bg-navy/10 text-navy",
    /**
     * Written for two readers at once.
     *
     * Usually this is someone who abandoned checkout, and the first sentence
     * is all they need. But a payment can reach us late — the bank
     * authorises after our hold lapsed, or the gateway retries a failed
     * delivery for up to 24 hours — and in that window this page is the
     * first thing a customer who HAS paid will look at. "The seats were
     * released" reads as "your money is gone", so the second sentence is
     * there for them. It confirms itself: when the payment lands the status
     * flips to Confirmed and they get the usual email.
     */
    body:
      "We didn't receive payment in time, so the seats were released. If you did pay, " +
      "it can occasionally take a few minutes to reach us — we'll confirm and email you " +
      "as soon as it does.",
  },
};

/**
 * The status shown to the customer.
 *
 * REQUESTED means two very different things depending on whether money has
 * arrived. Normally it's a booking the team will ring about to collect
 * payment. But it is also where a booking lands when a payment came through
 * *after* the seat hold expired and the trip had filled — and telling
 * someone who has just paid ₹1,013 that "our team will contact you to
 * arrange payment" is both wrong and alarming.
 *
 * The amount paid is what tells the two apart.
 */
function statusFor(bookingStatus: string, amountPaidPaise: number) {
  if (bookingStatus === "REQUESTED" && amountPaidPaise > 0) {
    return {
      label: "Payment received",
      tone: "bg-yellow text-navy",
      body:
        "We have your payment, but the last seat was taken moments before it reached us. " +
        "That's on us — one of us will call you within one working day with a seat on the " +
        "next departure or a full refund. Your money is safe in the meantime.",
    };
  }

  return (
    STATUS_COPY[bookingStatus] ?? {
      label: bookingStatus,
      tone: "bg-navy/10 text-navy",
      body: "",
    }
  );
}

export default async function BookingDetailPage({ params, searchParams }: Params) {
  const { reference } = await params;
  const { new: isNew } = await searchParams;

  const profile = await requireUser(`/account/bookings/${reference}`);
  const booking = await getBookingForCustomer(reference, profile.id);
  if (!booking) notFound();

  const status = statusFor(booking.status, booking.amountPaidPaise);
  const advanceDuePaise = (booking.trip.advancePaise ?? 0) * booking.seats;
  const balancePaise = booking.totalPaise - booking.amountPaidPaise;

  return (
    <>
      <Navbar variant="solid" />
      <main className="min-h-screen bg-cream-soft pb-24 pt-28 md:pt-32">
        <div className="mx-auto max-w-3xl px-4 md:px-8">
          <Link
            href="/account"
            className="inline-flex items-center gap-1.5 text-sm text-navy/60 transition hover:text-navy"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Your bookings
          </Link>

          {isNew && (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-teal/25 bg-teal/[0.07] px-5 py-4">
              <span className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full bg-teal text-cream">
                <Check className="h-3.5 w-3.5" />
              </span>
              <div>
                <p className="font-display text-lg leading-tight text-navy">
                  That&apos;s done — your seats are held.
                </p>
                <p className="mt-1 text-[0.9rem] leading-relaxed text-navy/65">
                  A confirmation is on its way to {profile.email}. Nothing has been charged.
                </p>
              </div>
            </div>
          )}

          <div className="mt-6 overflow-hidden rounded-3xl border border-navy/8 bg-cream">
            <header className="flex flex-wrap items-start gap-4 border-b border-navy/8 px-6 py-5 md:px-8">
              <div className="min-w-0">
                <p className="font-mono text-[0.8rem] text-navy/50">{booking.reference}</p>
                <h1 className="mt-0.5 font-display text-3xl leading-tight tracking-tight text-navy">
                  {booking.trip.title}
                </h1>
                <p className="mt-1 text-[0.88rem] text-navy/60">
                  {booking.trip.batchName && <span>{booking.trip.batchName} · </span>}
                  {formatDateRange(
                    booking.trip.startDate.toISOString(),
                    booking.trip.endDate.toISOString(),
                  )}
                </p>
              </div>
              <span
                className={`ml-auto inline-flex flex-none items-center rounded-full px-3 py-1 text-[0.78rem] font-semibold ${status.tone}`}
              >
                {status.label}
              </span>
            </header>

            {status.body && (
              <p className="border-b border-navy/8 bg-cream-soft px-6 py-4 text-[0.9rem] text-navy/70 md:px-8">
                {status.body}
              </p>
            )}

            <section className="px-6 py-6 md:px-8">
              <h2 className="text-[0.75rem] font-semibold uppercase tracking-[0.11em] text-navy/45">
                Travellers
              </h2>
              <ul className="mt-3 flex flex-col gap-2.5">
                {booking.travellers.map((t, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-3">
                    <span className="font-medium text-navy">{t.fullName}</span>
                    {(t.phone || t.email) && (
                      <span className="text-[0.85rem] text-navy/50">
                        {[t.phone, t.email].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>

              {booking.travellers[0]?.emergencyContactName && (
                <p className="mt-4 text-[0.85rem] text-navy/55">
                  <span className="font-medium text-navy/70">Emergency contact:</span>{" "}
                  {[
                    booking.travellers[0].emergencyContactName,
                    booking.travellers[0].emergencyContactPhone,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </section>

            <section className="border-t border-navy/8 px-6 py-6 md:px-8">
              <h2 className="text-[0.75rem] font-semibold uppercase tracking-[0.11em] text-navy/45">
                What it costs
              </h2>
              {/* Read from the booking's own snapshot, not the trip — if the
                  team reprices the trip tomorrow, this must still show what
                  was actually agreed. */}
              <dl className="mt-3 text-[0.9rem]">
                <Line
                  label={`${formatINR(toRupees(booking.unitPricePaise))} × ${booking.seats} ${booking.seats === 1 ? "traveller" : "travellers"}`}
                  value={formatINR(toRupees(booking.subtotalPaise))}
                />
                <Line label={`GST ${booking.gstPercent}%`} value={formatINR(toRupees(booking.gstPaise))} />
                {booking.tcsPercent > 0 && (
                  <Line label={`TCS ${booking.tcsPercent}%`} value={formatINR(toRupees(booking.tcsPaise))} />
                )}
                <div className="mt-2 flex items-baseline justify-between border-t border-navy/10 pt-2.5">
                  <dt className="font-medium text-navy">Total</dt>
                  <dd className="font-display text-xl tabular-nums text-navy">
                    {formatINR(toRupees(booking.totalPaise))}
                  </dd>
                </div>
                {booking.amountPaidPaise > 0 && (
                  <Line label="Paid" value={formatINR(toRupees(booking.amountPaidPaise))} />
                )}
                {balancePaise > 0 && (
                  <div className="mt-3 rounded-xl bg-cream-soft px-4 py-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[0.85rem] text-navy/65">
                        {booking.amountPaidPaise > 0 ? "Balance" : "Advance to confirm"}
                      </span>
                      <b className="font-display text-lg tabular-nums text-navy">
                        {formatINR(
                          toRupees(
                            booking.amountPaidPaise > 0 || advanceDuePaise === 0
                              ? balancePaise
                              : advanceDuePaise,
                          ),
                        )}
                      </b>
                    </div>
                  </div>
                )}
              </dl>
            </section>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a
              href={siteConfig.whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary inline-flex justify-center"
            >
              <MessageCircle className="h-4 w-4" /> Message us about this booking
            </a>
            <Link
              href={`/trips/${booking.trip.slug}`}
              className="btn inline-flex justify-center border border-navy/20 text-navy transition hover:bg-navy/[0.04]"
            >
              View the trip
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-3">
      <dt className="text-navy/65">{label}</dt>
      <dd className="tabular-nums text-navy">{value}</dd>
    </div>
  );
}
