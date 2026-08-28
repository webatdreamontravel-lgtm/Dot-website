import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { requireAdmin } from "@/lib/auth";
import { getAdminBooking, rupees } from "@/lib/queries/admin";
import { formatDateRange, formatINR } from "@/lib/utils";
import { BOOKING_TONE, Chip, PAYMENT_TONE, Panel } from "../../ui";
import { DetailsPanel, PaymentPanel, RefundPanel, StatusPanel } from "./BookingManager";

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
  const balancePaise = booking.totalPaise - booking.amountPaidPaise;
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
        <Stat label="Total" value={formatINR(rupees(booking.totalPaise))} />
        <Stat label="Paid" value={formatINR(rupees(booking.amountPaidPaise))} tone="ok" />
        <Stat
          label="Balance"
          value={formatINR(rupees(Math.max(balancePaise, 0)))}
          tone={balancePaise > 0 ? "warn" : undefined}
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

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  const colour = tone === "ok" ? "text-[#0f8a5f]" : tone === "warn" ? "text-[#b26a00]" : "";
  return (
    <div className="rounded-[14px] border border-[#e3e7ee] bg-white p-[15px_18px] shadow-sm">
      <div className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-[#8b96ad]">
        {label}
      </div>
      <div className={`mt-1.5 font-display text-[1.5rem] font-semibold tabular-nums ${colour}`}>
        {value}
      </div>
    </div>
  );
}
