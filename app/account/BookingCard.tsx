import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CalendarDays, MapPin, Users } from "lucide-react";

import { toRupees } from "@/lib/booking/pricing";
import { amountOutstanding } from "@/lib/booking/balance";
import { canPayBalanceOnline, customerStatus } from "@/lib/booking/customerStatus";
import { cn, formatDateRange, formatINR } from "@/lib/utils";
import { BalancePayment } from "@/app/account/bookings/[reference]/BalancePayment";

export type BookingRow = {
  id: string;
  /** Decided in the query, against one clock for the whole list. */
  departed: boolean;
  reference: string;
  status: string;
  seats: number;
  totalPaise: number;
  amountPaidPaise: number;
  /** What has come back. Drives the cancellation-charge wording. */
  refundedPaise: number;
  /** Ledger entries this booking created, when it was carried forward. */
  creditIssued?: { amountPaise: number }[];
  trip: {
    slug: string;
    title: string;
    destination: string | null;
    startDate: Date;
    endDate: Date;
    cardImage: string | null;
    razorpayEnabled: boolean;
  };
};

/**
 * One booking, as a card.
 *
 * Three deliberate choices:
 *
 * It leads with what is OWED, not the trip total. The old design showed
 * ₹2,624 on a booking with ₹1,013 already paid, which reads as unpaid — the
 * one number a customer wants at a glance is what they still have to find.
 *
 * The pay button is on the card. Making someone open a booking to discover
 * how to pay adds a step to the only action this page exists to support.
 *
 * The whole card is not a link. It contains a button, and nesting an
 * interactive control inside a link is both invalid and unpredictable to
 * operate — so the title is the link and the card is a plain container.
 */
export function BookingCard({
  booking,
  customer,
}: {
  booking: BookingRow;
  customer: { name: string | null; email: string; phone: string | null };
}) {
  // Same figure the detail page shows, so the card and the booking behind
  // it can't quote different amounts.
  const carriedForwardPaise =
    booking.creditIssued?.reduce((n, c) => n + c.amountPaise, 0) ?? 0;
  const status = customerStatus({ ...booking, creditIssuedPaise: carriedForwardPaise });

  const balance = amountOutstanding({ ...booking, creditIssuedPaise: carriedForwardPaise });
  const active = ["CONFIRMED", "REQUESTED"].includes(booking.status);
  const canPay = canPayBalanceOnline(booking);
  // Owed money on a booking nobody can pay online yet. The card must say why
  // rather than leaving a bare figure with no action beside it.
  const awaitingTeam = active && !canPay && balance > 0 && Boolean(status.note);
  /**
   * What the booking is holding right now — not what was handed over.
   *
   * The caption read `amountPaidPaise of totalPaise`, which sat directly
   * under its own contradiction: "Still to pay ₹7,200" above
   * "₹10,700 of ₹10,700 paid", bar full. Gross paid answers a
   * different question from the headline, so the two disagreed by exactly
   * the money that had gone back out.
   */
  const heldPaise = Math.max(
    booking.amountPaidPaise - booking.refundedPaise - carriedForwardPaise,
    0,
  );
  const paidPct = booking.totalPaise > 0
    ? Math.min(100, Math.round((heldPaise / booking.totalPaise) * 100))
    : 0;

  return (
    <li
      className={cn(
        "group overflow-hidden rounded-2xl border border-navy/8 bg-cream transition hover:border-navy/20 hover:shadow-[0_2px_16px_-8px_rgba(15,30,61,0.25)]",
        booking.departed && "opacity-75",
      )}
    >
      <div className="flex gap-4 p-4 sm:gap-5 sm:p-5">
        {/* Hidden below sm: on a phone the width is better spent on the
            numbers than on a 96px thumbnail. */}
        <div className="relative hidden h-24 w-24 flex-none overflow-hidden rounded-xl bg-navy/5 sm:block">
          {booking.trip.cardImage ? (
            <Image src={booking.trip.cardImage} alt="" fill sizes="96px" className="object-cover" />
          ) : (
            <MapPin className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-navy/20" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          {/* Reference and status share a row so the badge never pushes the
              title into an extra line — the two shortest things sit together
              and the title gets the full width beneath them. */}
          <div className="flex items-center gap-3">
            <p className="min-w-0 flex-1 truncate font-mono text-[0.7rem] uppercase tracking-wider text-navy/35">
              {booking.reference}
            </p>
            <span
              className={cn(
                "inline-flex flex-none rounded-full px-2.5 py-1 text-[0.72rem] font-semibold",
                status.tone,
              )}
            >
              {status.label}
            </span>
          </div>

          <h3 className="mt-1 font-display text-[1.15rem] leading-snug text-navy [text-wrap:balance] sm:text-[1.35rem]">
            <Link
              href={`/account/bookings/${booking.reference}`}
              className="transition hover:text-teal focus-visible:text-teal"
            >
              {booking.trip.title}
            </Link>
          </h3>

          {/* One metadata line, not three. batchName used to sit here — it is
              an internal label ("Rajasthan 2026 · Batch 1") that was never
              meant to be shown to a customer, and on a phone it pushed the
              card a whole line taller to say nothing. */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.85rem] text-navy/55">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 flex-none" aria-hidden />
              {formatDateRange(
                booking.trip.startDate.toISOString(),
                booking.trip.endDate.toISOString(),
              )}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 flex-none" aria-hidden />
              {booking.seats} {booking.seats === 1 ? "traveller" : "travellers"}
            </span>
          </div>

          {/* Money gets the full width rather than sharing a row with the
              Details button. At 360px that row was two cramped columns; now
              the figure is the widest thing on the card, which is what a
              customer opens this page to read. */}
          <div className="mt-3.5 border-t border-navy/8 pt-3.5">
            {balance > 0 && active ? (
              <>
                <p className="text-[0.75rem] font-medium uppercase tracking-wide text-navy/45">
                  Still to pay
                </p>
                <p className="mt-0.5 font-display text-2xl leading-none text-navy">
                  {formatINR(toRupees(balance))}
                </p>
                <p className="mt-1.5 text-[0.78rem] text-navy/45">
                  {formatINR(toRupees(heldPaise))} of{" "}
                  {formatINR(toRupees(booking.totalPaise))} paid
                </p>
                {heldPaise > 0 && (
                  <div
                    className="mt-2 h-1 w-full max-w-[200px] overflow-hidden rounded-full bg-navy/10"
                    role="img"
                    aria-label={`${paidPct}% paid`}
                  >
                    <div className="h-full rounded-full bg-teal" style={{ width: `${paidPct}%` }} />
                  </div>
                )}
              </>
            ) : booking.amountPaidPaise > 0 ? (
              <>
                {/* Once money has changed hands, the headline is what THEY
                    paid — never the booking total.
                    
                    A cancelled booking where someone paid a ₹500 advance and
                    got it all back was headlined "Booking total ₹2,100": a
                    figure that never applied to them, on a booking that cost
                    them nothing. Same problem on a repriced booking, where
                    the total drops but the money paid does not. */}
                <p className="text-[0.75rem] font-medium uppercase tracking-wide text-navy/45">
                  {booking.refundedPaise > 0 || !active ? "You paid" : "Paid in full"}
                </p>
                <p className="mt-0.5 font-display text-2xl leading-none text-navy">
                  {formatINR(toRupees(booking.amountPaidPaise))}
                </p>
                {booking.refundedPaise > 0 && (
                  <p className="mt-1.5 text-[0.78rem] text-navy/45">
                    {booking.refundedPaise >= booking.amountPaidPaise
                      ? "All of it refunded"
                      : `${formatINR(toRupees(booking.refundedPaise))} refunded`}
                  </p>
                )}
              </>
            ) : (
              /* Nothing was ever paid — an abandoned checkout or a booking
                 cancelled before payment. The trip price is the only figure
                 there is, and "you paid ₹0" would be noise. */
              <>
                <p className="text-[0.75rem] font-medium uppercase tracking-wide text-navy/45">
                  Booking total
                </p>
                <p className="mt-0.5 font-display text-2xl leading-none text-navy">
                  {formatINR(toRupees(booking.totalPaise))}
                </p>
              </>
            )}
          </div>

          {/* Both actions in one row at the foot of the card. Details used to
              sit halfway up beside the money and Pay below it, which read as
              two unrelated controls. gap-2 keeps 8px between touch targets. */}
          <div className="mt-3.5 flex items-center gap-2">
            {canPay ? (
              <BalancePayment
                reference={booking.reference}
                balancePaise={balance}
                tripTitle={booking.trip.title}
                customer={customer}
                compact
              />
            ) : null}
            <Link
              href={`/account/bookings/${booking.reference}`}
              className={cn(
                "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-navy/15 px-4 text-[0.85rem] font-medium text-navy transition hover:bg-navy/[0.04]",
                canPay ? "flex-none" : "flex-1 sm:flex-none",
              )}
            >
              Details
              <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </Link>
          </div>

          {awaitingTeam && (
            <p className="mt-3 rounded-xl bg-navy/[0.04] px-3.5 py-2.5 text-[0.82rem] leading-relaxed text-navy/65">
              {status.note}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}
