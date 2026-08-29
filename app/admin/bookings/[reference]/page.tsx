import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { requireAdmin } from "@/lib/auth";
import { getAdminBooking, rupees } from "@/lib/queries/admin";
import { formatDateRange, formatINR } from "@/lib/utils";
import { BOOKING_TONE, Chip, PAYMENT_TONE, Panel } from "../../ui";
import { prisma } from "@/lib/prisma";
import {
  DetailsPanel,
  PaymentPanel,
  RefundPanel,
  ReminderPanel,
  StatusPanel,
} from "./BookingManager";

export const metadata = { title: "Booking" };

const METHOD_LABEL: Record<string, string> = {
  CASH: "Cash",
  UPI_MANUAL: "UPI",
  BANK_TRANSFER: "Bank transfer",
  RAZORPAY: "Razorpay",
  OTHER: "Other",
};

export default async function AdminBookingPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  await requireAdmin();
  const { reference } = await params;
  const booking = await getAdminBooking(decodeURIComponent(reference));
  if (!booking) notFound();

  const status = BOOKING_TONE[booking.status] ?? { tone: "mute", label: booking.status };
  /**
   * The money, as three related figures rather than two unrelated ones.
   *
   *   netHeld    what we are actually holding: paid minus refunded. This is
   *              the number that reconciles against a bank balance, and the
   *              one every other figure should be measured from.
   *   balance    what the customer still owes.
   *   overpaid   what we owe them. A booking repriced after a traveller drops
   *              out ends up paid past its own total, which is not a bug and
   *              was previously invisible — "Balance ₹0" and a "Paid in full"
   *              badge on a booking holding ₹100 that isn't ours.
   *
   * Exactly one of balance/overpaid can be non-zero.
   */
  const netHeldPaise = booking.amountPaidPaise - booking.refundedPaise;
  const balancePaise = Math.max(booking.totalPaise - netHeldPaise, 0);
  const overpaidPaise = Math.max(netHeldPaise - booking.totalPaise, 0);
  // What customers paid ON TOP, per Razorpay's "customer pays the fee"
  // setting. Never added to the balance — this went straight to Razorpay and
  // was never DOT's. Zero for cash and for anything paid before the setting
  // was switched on.
  // When a reminder last went out — automated or manual. Shown so nobody
  // nudges someone who was emailed an hour ago.
  const lastReminderAt =
    (
      await prisma.emailLog.findFirst({
        where: { bookingId: booking.id, template: "balance_reminder", status: "SENT" },
        orderBy: { createdAt: "desc" },
        select: { sentAt: true, createdAt: true },
      })
    )?.sentAt ?? null;

  const feesCollected = booking.payments
    .filter((p) => p.status === "CAPTURED")
    .reduce((n, p) => n + p.convenienceFeePaise, 0);
  const paymentState =
    booking.amountPaidPaise === 0 ? "UNPAID" : balancePaise <= 0 ? "PAID" : "PARTIAL";
  const pay = PAYMENT_TONE[paymentState];
  const seatsCounted = ["REQUESTED", "CONFIRMED"].includes(booking.status);

  return (
    <>
      <header className="mb-6 flex flex-wrap items-start gap-4">
        <div className="min-w-0">
          <Link
            href={`/admin/trips/${booking.trip.id}/bookings`}
            className="mb-1 inline-flex items-center gap-1.5 text-[0.82rem] text-[#5a6785] hover:text-navy"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {booking.trip.title} bookings
          </Link>
          <h1 className="font-mono text-[1.35rem] font-semibold tracking-tight text-navy">
            {booking.reference}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[0.85rem] text-[#8b96ad]">
            <Chip tone={status.tone}>{status.label}</Chip>
            <Chip tone={pay.tone}>{pay.label}</Chip>
            <span>
              {booking.trip.batchName && `${booking.trip.batchName} · `}
              {formatDateRange(
                booking.trip.startDate.toISOString(),
                booking.trip.endDate.toISOString(),
              )}
            </span>
          </p>
        </div>

        <Link
          href={`/admin/customers/${booking.profile.id}`}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-[#e3e7ee] bg-white px-3.5 py-2 text-[0.85rem] hover:bg-[#eef1f6]"
        >
          {booking.profile.fullName ?? booking.profile.email}
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </header>

      <div className="mb-5 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Seats" value={String(booking.seats)} />
        <Stat label="Trip total" value={formatINR(rupees(booking.totalPaise))} />
        {/* Net, not gross. "Paid ₹6,300" on a booking where ₹2,000 has gone
            back overstates what we hold by exactly the refund. */}
        <Stat
          label="Held"
          value={formatINR(rupees(netHeldPaise))}
          sub={
            booking.refundedPaise > 0
              ? `${formatINR(rupees(booking.amountPaidPaise))} paid · ${formatINR(
                  rupees(booking.refundedPaise),
                )} refunded`
              : undefined
          }
          tone="ok"
        />
        <Stat
          label={overpaidPaise > 0 ? "To refund" : "Balance"}
          value={formatINR(rupees(overpaidPaise > 0 ? overpaidPaise : balancePaise))}
          sub={overpaidPaise > 0 ? "held above the trip total" : undefined}
          tone={overpaidPaise > 0 || balancePaise > 0 ? "warn" : undefined}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.25fr_0.85fr] lg:items-start">
        <div>
          <DetailsPanel
            bookingId={booking.id}
            source={booking.source}
            internalNotes={booking.internalNotes}
            travellers={booking.travellers}
            // Removing a seat from an already-cancelled booking would give
            // the trip seats it never lost.
            canRemoveSeat={seatsCounted}
          />

          <Panel title={`Payments (${booking.payments.length})`}>
            {booking.payments.length === 0 ? (
              <p className="px-5 py-6 text-center text-[0.86rem] text-[#8b96ad]">
                Nothing received yet.
              </p>
            ) : (
              <ul className="divide-y divide-[#eef1f6]">
                {booking.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3">
                    <span className="font-display text-[1.05rem] font-semibold tabular-nums text-navy">
                      {formatINR(rupees(p.amountPaise))}
                    </span>
                    {/* The split, only where there is one. A convenience fee
                        is money in transit to the gateway, so the amount that
                        reached this booking is smaller than the amount
                        charged — and the difference has to be visible or the
                        totals below look wrong. */}
                    {p.convenienceFeePaise > 0 && (
                      <span className="text-[0.8rem] text-[#8b96ad]">
                        → booking{" "}
                        <b className="font-medium text-[#16203a]">
                          {formatINR(rupees(p.amountPaise - p.convenienceFeePaise))}
                        </b>{" "}
                        · fee {formatINR(rupees(p.convenienceFeePaise))}
                      </span>
                    )}
                    <Chip tone="mute">{METHOD_LABEL[p.method] ?? p.method}</Chip>
                    {p.status !== "CAPTURED" && <Chip tone="warn">{p.status}</Chip>}
                    <span className="text-[0.8rem] text-[#8b96ad]">
                      {(p.capturedAt ?? p.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      {p.externalReference && ` · ${p.externalReference}`}
                      {p.recordedBy && ` · by ${p.recordedBy.fullName ?? p.recordedBy.email}`}
                    </span>
                    {p.notes && (
                      <span className="w-full text-[0.8rem] text-[#5a6785]">{p.notes}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {feesCollected > 0 && (
              <div className="border-t border-[#eef1f6] px-5 py-3 text-[0.83rem]">
                <div className="flex items-baseline justify-between">
                  <span className="text-[#5a6785]">Toward this booking</span>
                  <b className="tabular-nums text-[#16203a]">
                    {formatINR(rupees(booking.amountPaidPaise))}
                  </b>
                </div>
                {/* Deliberately below the booking total and greyed: this is
                    not income. Seeing it beside the trip amount is what makes
                    that obvious at a glance. */}
                <div className="mt-1 flex items-baseline justify-between text-[#8b96ad]">
                  <span>Razorpay fee paid by customers</span>
                  <span className="tabular-nums">{formatINR(rupees(feesCollected))}</span>
                </div>
              </div>
            )}
          </Panel>

          <Panel title="Price breakdown">
            <dl className="px-5 py-4 text-[0.88rem]">
              <Line
                label={`${formatINR(rupees(booking.unitPricePaise))} × ${booking.seats}`}
                value={formatINR(rupees(booking.subtotalPaise))}
              />
              <Line label={`GST ${booking.gstPercent}%`} value={formatINR(rupees(booking.gstPaise))} />
              {booking.tcsPercent > 0 && (
                <Line label={`TCS ${booking.tcsPercent}%`} value={formatINR(rupees(booking.tcsPaise))} />
              )}
              <div className="mt-2 flex items-baseline justify-between border-t border-[#eef1f6] pt-2">
                <dt className="font-medium text-navy">Total</dt>
                <dd className="font-display text-lg tabular-nums text-navy">
                  {formatINR(rupees(booking.totalPaise))}
                </dd>
              </div>
              {booking.trip.advancePaise && (
                <p className="mt-2 text-[0.78rem] text-[#8b96ad]">
                  Advance for this party:{" "}
                  {formatINR(rupees(booking.trip.advancePaise * booking.seats))}
                </p>
              )}
            </dl>
          </Panel>
        </div>

        <div>
          <PaymentPanel bookingId={booking.id} balancePaise={Math.max(balancePaise, 0)} />

          {/* Only PROCESSED refunds have actually left the account; PENDING
              ones are with Razorpay. Both are held back from the refundable
              ceiling so a second refund can't be raised against money that is
              already on its way out. */}
          <RefundPanel
            reference={booking.reference}
            owedPaise={overpaidPaise}
            refundedPaise={booking.refunds
              .filter((r) => r.status === "PROCESSED")
              .reduce((n, r) => n + r.amountPaise, 0)}
            pendingPaise={booking.refunds
              .filter((r) => r.status === "PENDING")
              .reduce((n, r) => n + r.amountPaise, 0)}
            refundablePaise={Math.max(
              booking.amountPaidPaise -
                booking.refunds
                  .filter((r) => r.status !== "FAILED")
                  .reduce((n, r) => n + r.amountPaise, 0),
              0,
            )}
            hasOnlinePayment={booking.payments.some(
              (p) => p.method === "RAZORPAY" && p.status === "CAPTURED" && p.razorpayPaymentId,
            )}
          />
          <StatusPanel
            bookingId={booking.id}
            status={booking.status}
            seatsCounted={seatsCounted}
            customerEmail={booking.profile.email ?? booking.travellers[0]?.email ?? null}
          />

          <ReminderPanel
            reference={booking.reference}
            balancePaise={Math.max(balancePaise, 0)}
            lastSentAt={lastReminderAt}
          />

          {booking.cancellationReason && (
            <Panel title="Cancellation">
              <p className="px-5 py-4 text-[0.86rem] text-[#5a6785]">{booking.cancellationReason}</p>
            </Panel>
          )}

          <Panel title="Timeline">
            <ul className="px-5 py-4 text-[0.83rem] text-[#5a6785]">
              <TimeRow label="Booked" at={booking.createdAt} />
              <TimeRow label="Confirmed" at={booking.confirmedAt} />
              <TimeRow label="Cancelled" at={booking.cancelledAt} />
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}

function TimeRow({ label, at }: { label: string; at: Date | null }) {
  if (!at) return null;
  return (
    <li className="flex justify-between gap-3 py-1">
      <span>{label}</span>
      <span className="tabular-nums text-navy">
        {at.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
      </span>
    </li>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-3">
      <dt className="text-[#5a6785]">{label}</dt>
      <dd className="tabular-nums text-navy">{value}</dd>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  /** The working underneath the figure — "₹6,300 paid · ₹2,000 refunded". */
  sub?: string;
  tone?: "ok" | "warn";
}) {
  const colour = tone === "ok" ? "text-[#0f8a5f]" : tone === "warn" ? "text-[#b26a00]" : "";
  return (
    <div className="rounded-[14px] border border-[#e3e7ee] bg-white p-[15px_18px] shadow-sm">
      <div className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-[#8b96ad]">
        {label}
      </div>
      <div className={`mt-1.5 font-display text-[1.5rem] font-semibold tabular-nums ${colour}`}>
        {value}
      </div>
      {sub && <div className="mt-1 text-[0.75rem] leading-snug text-[#8b96ad]">{sub}</div>}
    </div>
  );
}
