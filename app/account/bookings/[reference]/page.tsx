import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, MessageCircle, RotateCcw } from "lucide-react";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { requireUser } from "@/lib/auth";
import { toRupees } from "@/lib/booking/pricing";
import { amountOutstanding } from "@/lib/booking/balance";
import { getBookingForCustomer } from "@/lib/queries/booking";
import { canPayBalanceOnline, customerStatus, REFUND_NOTICE } from "@/lib/booking/customerStatus";
import { siteConfig } from "@/lib/data/siteConfig";
import { formatDateRange, formatINR } from "@/lib/utils";
import { BalancePayment } from "./BalancePayment";

type Params = {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ new?: string }>;
};

export const metadata: Metadata = { title: "Your booking", robots: { index: false } };

/**
 * How a payment method is described to the person who made it.
 *
 * Not the admin's vocabulary: "UPI_MANUAL" means the team keyed in a transfer
 * the customer made, which from their side was simply UPI. And RAZORPAY is an
 * implementation detail — what they remember is paying on the website.
 */
const HOW_PAID: Record<string, string> = {
  RAZORPAY: "Paid online",
  UPI_MANUAL: "UPI",
  CASH: "Cash",
  BANK_TRANSFER: "Bank transfer",
  CREDIT: "Travel credit",
  OTHER: "Other",
};

/**
 * How money went back, in the customer's terms.
 *
 * Only the first has a wait attached to it — everything else was handed over
 * or transferred by a person, and had already reached them before the page
 * did. Saying "5 to 7 working days" about cash they are holding is nonsense.
 */
const HOW_REFUNDED: Record<string, string> = {
  RAZORPAY: "Back to the account you paid from",
  UPI: "By UPI",
  CASH: "In cash",
  BANK_TRANSFER: "To your bank account",
  OTHER: "Returned to you",
};

export default async function BookingDetailPage({ params, searchParams }: Params) {
  const { reference } = await params;
  const { new: isNew } = await searchParams;
  // Set by the checkout flow only when Razorpay actually took the money.
  const paidNow = isNew === "paid";

  const profile = await requireUser(`/account/bookings/${reference}`);
  const booking = await getBookingForCustomer(reference, profile.id);
  if (!booking) notFound();

  /**
   * What left this booking for their travel credit.
   *
   * Read from the ledger entries the booking created, never inferred from
   * `paid − refunded`: a cancellation charge or a goodwill top-up makes
   * those two different numbers, and the subtraction stops reconstructing
   * the decision the moment another refund lands.
   */
  const carriedForwardPaise = booking.creditIssued.reduce((n, c) => n + c.amountPaise, 0);
  const status = customerStatus({ ...booking, creditIssuedPaise: carriedForwardPaise });
  const advanceDuePaise = (booking.trip.advancePaise ?? 0) * booking.seats;
  const balancePaise = amountOutstanding(booking);

  const canPayBalance = canPayBalanceOnline(booking);

  const feesCharged = booking.payments
    .filter((p) => p.status === "CAPTURED")
    .reduce((n, p) => n + p.convenienceFeePaise, 0);

  /**
   * Worth breaking down when the total can't speak for itself.
   *
   * One online payment needs no list — "You paid ₹4,200" and the statement
   * line below it already say everything. But a booking settled partly in
   * cash, or partly from travel credit, leaves someone hunting their bank
   * statement for money that was never going to be there.
   */
  const showSplit =
    booking.payments.length > 1 || booking.payments.some((p) => p.method === "CREDIT");

  /**
   * The bank-wait notice belongs to gateway refunds and nothing else.
   *
   * It used to appear whenever any money had gone back, so someone handed
   * ₹1,000 in cash across a table was told to expect it in five to seven
   * working days. Keyed on there actually being a Razorpay refund.
   */
  /**
   * Grouped by method, not listed one per row.
   *
   * Two Razorpay refunds a minute apart are one fact to a customer — "₹1,410
   * back to your card" — and printing the same sentence twice with different
   * figures reads like a mistake. The dates go with it: a grouped line can't
   * carry one date honestly.
   */
  const refundsByMethod = [...booking.refunds]
    .reduce<{ method: string; amountPaise: number }[]>((acc, r) => {
      const found = acc.find((x) => x.method === r.method);
      if (found) found.amountPaise += r.amountPaise;
      else acc.push({ method: r.method, amountPaise: r.amountPaise });
      return acc;
    }, []);

  /**
   * The bank-wait notice belongs to the gateway portion, and names only that.
   *
   * On a booking refunded ₹1,410 to a card and ₹1,800 in cash, telling
   * someone "₹3,210 refunded, allow 5–7 working days" sets them looking for
   * money that is already in their pocket.
   */
  const gatewayRefundedPaise = booking.refunds
    .filter((r) => r.method === "RAZORPAY")
    .reduce((n, r) => n + r.amountPaise, 0);
  const showRefundSplit = refundsByMethod.length > 1;

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
                  {paidNow ? "Payment received — you're booked." : "That's done — your seats are held."}
                </p>
                <p className="mt-1 text-[0.9rem] leading-relaxed text-navy/65">
                  {paidNow ? (
                    <>
                      A receipt is on its way to {profile.email}.
                      {/* Only once the payment has actually landed on the booking.
                          Until then `balancePaise` is still the whole trip, and
                          quoting it would name a figure they have just paid. */}
                      {booking.amountPaidPaise > 0 && balancePaise > 0 && (
                        <>
                          {" "}
                          The remaining {formatINR(toRupees(balancePaise))} is due before
                          departure — the date is below.
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      A confirmation is on its way to {profile.email}. Nothing has been
                      charged — the team will contact you to arrange payment.
                    </>
                  )}
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

            {/* Any booking with money back on it, whatever its status. The
                week of bank silence after a refund is sent is the same
                whether it followed a cancellation, a repricing or a goodwill
                gesture — so this is keyed on the refund existing, not on why
                it happened.

                Teal, not coral: a refund is money returning to the customer,
                not something that went wrong. Red here would make everyone
                who reads it think their booking had failed — and it would
                spend the one colour this page reserves for actual problems on
                a message that is, on balance, good news. */}
            {gatewayRefundedPaise > 0 && (
              <div className="flex items-start gap-3 border-b border-navy/8 bg-teal/[0.07] px-6 py-4 md:px-8">
                <span className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full bg-teal text-cream">
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                </span>
                <p className="text-[0.85rem] leading-relaxed text-navy/70">
                  <span className="font-semibold text-navy">
                    {formatINR(toRupees(gatewayRefundedPaise))} refunded to your card or account.
                  </span>{" "}
                  {REFUND_NOTICE}
                </p>
              </div>
            )}

            <section className="px-6 py-6 md:px-8">
              <h2 className="text-[0.75rem] font-semibold uppercase tracking-[0.11em] text-navy/45">
                Travellers
              </h2>
              <ul className="mt-3 flex flex-col gap-2.5">
                {booking.travellers.map((t, i) => (
                  <li
                    key={i}
                    className={`flex flex-wrap items-baseline gap-x-3 ${
                      t.cancelledAt ? "text-navy/40" : ""
                    }`}
                  >
                    <span
                      className={
                        t.cancelledAt
                          ? "font-medium text-navy/45 line-through decoration-navy/30"
                          : "font-medium text-navy"
                      }
                    >
                      {t.fullName}
                    </span>
                    {/* Named rather than quietly removed. Two names beside a
                        total that used to cover three reads as a billing
                        error until you can see which person came off. */}
                    {t.cancelledAt && (
                      <span className="rounded-full bg-navy/[0.07] px-2 py-0.5 text-[0.75rem] font-semibold uppercase tracking-wide text-navy/50">
                        Cancelled
                      </span>
                    )}
                    {(t.phone || t.email) && (
                      <span className={`text-[0.85rem] ${t.cancelledAt ? "text-navy/35" : "text-navy/50"}`}>
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
                {showSplit && (
                  <div className="mt-3 border-t border-navy/10 pt-2.5">
                    <p className="mb-1.5 text-[0.75rem] font-semibold uppercase tracking-[0.11em] text-navy/45">
                      How you paid
                    </p>
                    {booking.payments.map((p, i) => (
                      <div key={i} className="mb-1.5 flex items-baseline justify-between gap-3">
                        <dt className="text-navy/65">
                          {HOW_PAID[p.method] ?? p.method}
                          <span className="ml-2 text-[0.78rem] text-navy/40">
                            {(p.capturedAt ?? p.createdAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                        </dt>
                        <dd className="tabular-nums text-navy">
                          {formatINR(toRupees(p.amountPaise))}
                        </dd>
                      </div>
                    ))}
                  </div>
                )}

                {booking.amountPaidPaise > 0 && (
                  <Line label="You paid" value={formatINR(toRupees(booking.amountPaidPaise))} />
                )}

                {/* Money already sent back. Absent from this page entirely
                    until now, so a customer who had been refunded ₹2,000 saw
                    only "You paid ₹6,300" and no sign of it. */}
                {showRefundSplit && (
                  <div className="mt-3 border-t border-navy/10 pt-2.5">
                    <p className="mb-1.5 text-[0.75rem] font-semibold uppercase tracking-[0.11em] text-navy/45">
                      How it was refunded
                    </p>
                    {refundsByMethod.map((r) => (
                      <div key={r.method} className="mb-1.5 flex items-baseline justify-between gap-3">
                        <dt className="text-navy/65">{HOW_REFUNDED[r.method] ?? r.method}</dt>
                        <dd className="tabular-nums text-navy">
                          − {formatINR(toRupees(r.amountPaise))}
                        </dd>
                      </div>
                    ))}
                  </div>
                )}

                {booking.refundedPaise > 0 && (
                  <Line
                    label={showRefundSplit ? "Refunded in total" : "Refunded to you"}
                    value={`− ${formatINR(toRupees(booking.refundedPaise))}`}
                  />
                )}

                {/* Not a refund — no money went back to them — so it gets its
                    own line rather than joining the block above. Without it
                    the page showed "You paid ₹29,398" and then nothing, and
                    the customer had no way to see where it went. */}
                {carriedForwardPaise > 0 && (
                  <Line
                    label="Kept as travel credit"
                    value={`− ${formatINR(toRupees(carriedForwardPaise))}`}
                    hint="Yours to spend on a future trip. It doesn't expire."
                  />
                )}

                {/* Razorpay adds its own fee at checkout, so the card
                    statement reads higher than "Paid" above. Someone
                    reconciling their bank statement against this page needs
                    that difference named, or it looks like we took more than
                    we said we would. */}
                {feesCharged > 0 && (
                  <Line
                    label="Payment gateway fee"
                    value={formatINR(toRupees(feesCharged))}
                    hint={`Your statement will show ${formatINR(
                      toRupees(booking.amountPaidPaise + feesCharged),
                    )} in total`}
                  />
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

                    {/* The point of the whole reminder: somewhere to actually
                        pay. Only shown once an advance has landed — before
                        that the booking flow itself is where they pay, and
                        two payment buttons on one screen is one too many. */}
                    {canPayBalance && (
                      <BalancePayment
                        reference={booking.reference}
                        balancePaise={balancePaise}
                        tripTitle={booking.trip.title}
                        customer={{
                          name: profile.fullName,
                          email: profile.email,
                          phone: profile.phone,
                        }}
                      />
                    )}
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

function Line({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  /** A quiet second line under the label, for context the figure needs. */
  hint?: string;
}) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-3">
      <dt className="text-navy/65">
        {label}
        {hint && <span className="mt-0.5 block text-[0.78rem] text-navy/40">{hint}</span>}
      </dt>
      <dd className="tabular-nums text-navy">{value}</dd>
    </div>
  );
}
