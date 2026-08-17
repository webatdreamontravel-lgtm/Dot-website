import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";

import { requireAdmin } from "@/lib/auth";
import { getAdminTrip, getBookingsForTrip, rupees } from "@/lib/queries/admin";
import { formatINR } from "@/lib/utils";
import { BOOKING_TONE, Chip, EmptyState, PAYMENT_TONE, Panel } from "../../../ui";
import { FilterBar, FilterField, FilterSelect, filterInputClass } from "../../../FilterBar";
import { Pagination } from "../../../Pagination";

export const metadata = { title: "Booking details" };

type SP = Promise<{
  q?: string; status?: string; payment?: string; source?: string;
  from?: string; to?: string; page?: string;
}>;

export default async function TripBookingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SP;
}) {
  await requireAdmin();
  const { id } = await params;
  const filters = await searchParams;

  const [trip, bookings] = await Promise.all([
    getAdminTrip(id),
    getBookingsForTrip(id, filters),
  ]);
  if (!trip) notFound();

  const hasFilters = Boolean(
    filters.q || filters.status || filters.payment || filters.source || filters.from || filters.to,
  );

  // Totals come from an aggregate over every match, so they stay correct on
  // page 2 — reducing the visible rows would report one page's worth of money.
  const { totals } = bookings;
  const action = `/admin/trips/${id}/bookings`;

  return (
    <>
      <header className="mb-6 flex flex-wrap items-start gap-4">
        <div className="min-w-0">
          <Link
            href="/admin/trips"
            className="mb-1 inline-flex items-center gap-1.5 text-[0.82rem] text-[#5a6785] hover:text-navy"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All trips
          </Link>
          <h1 className="font-display text-[1.85rem] font-semibold leading-tight tracking-tight">
            {trip.title}
          </h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[0.85rem] text-[#8b96ad]">
            {trip.batchName && (
              <span className="rounded bg-[#eef1f6] px-1.5 py-0.5 font-medium text-[#5a6785]">
                {trip.batchName}
              </span>
            )}
            <span>
              {trip.startDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </span>
            <span>·</span>
            <span>{trip.seatsBooked} of {trip.totalSeats} seats booked</span>
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href={`/admin/trips/${id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#e3e7ee] bg-white px-3.5 py-2 text-[0.85rem] hover:bg-[#eef1f6]"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit trip
          </Link>
          {/* Carries the trip, so the booking form opens with it already
              chosen — you're on this trip's page, you mean this trip. */}
          <Link
            href={`/admin/bookings/new?tripId=${id}`}
            className="rounded-lg bg-navy px-3.5 py-2 text-[0.85rem] font-medium text-cream hover:bg-[#1b2f56]"
          >
            + New booking
          </Link>
        </div>
      </header>

      {/* Seven figures: 4 + 3 on a wide screen keeps them all the same size
          rather than squeezing seven into one thin row. */}
      <div className="mb-5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={hasFilters ? "Bookings matching" : "Bookings"} value={String(totals.count)} />
        <Stat
          label="Seats taken"
          value={`${totals.seats}`}
          sub={`of ${trip.totalSeats}`}
        />
        <Stat
          label="Cancelled seats"
          value={String(totals.cancelledSeats)}
          sub={totals.cancelledSeats > 0 ? "released back to the trip" : undefined}
          tone={totals.cancelledSeats > 0 ? "warn" : undefined}
        />
        <Stat label="Collected" value={formatINR(rupees(totals.collectedPaise))} tone="ok" />
        <Stat
          label="To refund"
          value={formatINR(rupees(totals.toRefundPaise))}
          sub={totals.toRefundPaise > 0 ? "held on cancelled bookings" : undefined}
          tone={totals.toRefundPaise > 0 ? "warn" : undefined}
        />
        <Stat label="Refunded" value={formatINR(rupees(totals.refundedPaise))} />
        <Stat
          label="Outstanding"
          value={formatINR(rupees(totals.outstandingPaise))}
          tone={totals.outstandingPaise > 0 ? "warn" : undefined}
        />
      </div>

      <Panel>
        <FilterBar
          action={action}
          hasFilters={hasFilters}
          searchPlaceholder="Name, phone, email or booking ref…"
          table={
            bookings.rows.length === 0 ? (
              <EmptyState
                title={hasFilters ? "No bookings match those filters" : "No bookings for this trip yet"}
                body={
                  hasFilters
                    ? "Widen the date range or clear the payment filter."
                    : "Bookings appear here as soon as someone books from the site, or when you add one manually."
                }
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        {["Ref", "Customer", "Travellers", "Status", "Seats", "Total", "Paid", "Balance", "Payment", "Source", "Booked"].map((h) => (
                          <th
                            key={h}
                            className="whitespace-nowrap border-b border-[#e3e7ee] bg-[#fbfcfe] px-4 py-2.5 text-left text-[0.72rem] font-semibold uppercase tracking-[0.09em] text-[#8b96ad]"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.rows.map((b) => {
                        const status = BOOKING_TONE[b.status] ?? { tone: "mute", label: b.status };
                        const pay = PAYMENT_TONE[b.paymentState];
                        return (
                          <tr key={b.id} className="hover:bg-[#fafbfd]">
                            <td className="whitespace-nowrap border-b border-[#eef1f6] px-4 py-3">
                              <Link
                                href={`/admin/bookings/${b.reference}`}
                                className="font-mono text-[0.8rem] font-medium text-[#5a6785] underline-offset-2 hover:text-navy hover:underline"
                              >
                                {b.reference}
                              </Link>
                            </td>
                            <td className="border-b border-[#eef1f6] px-4 py-3">
                              {/* Falls back to the lead traveller: a profile
                                  created by one-time-code sign-in has only an
                                  email until its first booking. */}
                              <div className="text-[0.88rem] font-semibold">
                                {b.profile.fullName ??
                                  b.travellers.find((t) => !t.cancelledAt)?.fullName ??
                                  b.travellers[0]?.fullName ??
                                  "—"}
                              </div>
                              <div className="text-[0.78rem] text-[#8b96ad]">
                                {b.profile.phone ?? b.profile.email}
                              </div>
                            </td>
                            <td className="border-b border-[#eef1f6] px-4 py-3">
                              <TravellerList travellers={b.travellers} />
                            </td>
                            <td className="border-b border-[#eef1f6] px-4 py-3"><Chip tone={status.tone}>{status.label}</Chip></td>
                            <td className="border-b border-[#eef1f6] px-4 py-3 text-[0.85rem] tabular-nums">{b.seats}</td>
                            <td className="whitespace-nowrap border-b border-[#eef1f6] px-4 py-3 font-display text-[0.95rem] font-semibold tabular-nums">
                              {formatINR(rupees(b.totalPaise))}
                            </td>
                            <td className="whitespace-nowrap border-b border-[#eef1f6] px-4 py-3 font-display text-[0.95rem] font-semibold tabular-nums text-[#0f8a5f]">
                              {formatINR(rupees(b.amountPaidPaise))}
                            </td>
                            <td className={`whitespace-nowrap border-b border-[#eef1f6] px-4 py-3 font-display text-[0.95rem] font-semibold tabular-nums ${b.balancePaise > 0 ? "text-[#b26a00]" : "text-[#8b96ad]"}`}>
                              {b.balancePaise > 0 ? formatINR(rupees(b.balancePaise)) : "—"}
                            </td>
                            <td className="border-b border-[#eef1f6] px-4 py-3"><Chip tone={pay.tone}>{pay.label}</Chip></td>
                            <td className="border-b border-[#eef1f6] px-4 py-3"><Chip tone="mute">{b.source}</Chip></td>
                            <td className="whitespace-nowrap border-b border-[#eef1f6] px-4 py-3 text-[0.82rem] text-[#8b96ad]">
                              {b.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  action={action}
                  page={bookings.page}
                  pageCount={bookings.pageCount}
                  total={bookings.total}
                  perPage={bookings.perPage}
                  noun="bookings"
                />
              </>
            )
          }
        >
          <FilterField label="Booking status">
            <FilterSelect
              name="status"
              value={filters.status}
              placeholder="Any"
              options={Object.entries(BOOKING_TONE).map(([value, v]) => ({ value, label: v.label }))}
            />
          </FilterField>
          <FilterField label="Payment">
            <FilterSelect
              name="payment"
              value={filters.payment}
              placeholder="Any"
              options={Object.entries(PAYMENT_TONE).map(([value, v]) => ({ value, label: v.label }))}
            />
          </FilterField>
          <FilterField label="Source">
            <FilterSelect
              name="source"
              value={filters.source}
              placeholder="Any"
              options={[
                { value: "WEB", label: "Website" },
                { value: "ADMIN_OFFLINE", label: "Offline" },
                { value: "WHATSAPP", label: "WhatsApp" },
                { value: "FESTIVAL", label: "Festival" },
              ]}
            />
          </FilterField>
          <FilterField label="Booked from">
            <input type="date" name="from" defaultValue={filters.from ?? ""} className={filterInputClass} />
          </FilterField>
          <FilterField label="Booked to">
            <input type="date" name="to" defaultValue={filters.to ?? ""} className={filterInputClass} />
          </FilterField>
        </FilterBar>
      </Panel>
    </>
  );
}

/**
 * Every traveller with their own number and email.
 *
 * A comma-joined list of names was enough to see who was coming, but not to
 * do anything about it — the team chases people individually on WhatsApp, so
 * the contact details have to be here, not one click away.
 */
function TravellerList({
  travellers,
}: {
  travellers: {
    fullName: string;
    phone: string | null;
    email: string | null;
    cancelledAt: Date | string | null;
  }[];
}) {
  if (travellers.length === 0) {
    return <span className="text-[0.8rem] text-[#c3cad8]">—</span>;
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {travellers.map((t, i) => {
        const cancelled = !!t.cancelledAt;
        return (
          <li key={i} className={`leading-tight ${cancelled ? "opacity-50" : ""}`}>
            <span
              className={`text-[0.84rem] font-medium text-[#16203a] ${
                cancelled ? "line-through decoration-[#c33a3a]/60" : ""
              }`}
            >
              {t.fullName}
            </span>
            {cancelled && (
              <span className="ml-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[#c33a3a]">
                Cancelled
              </span>
            )}
            <span className="block whitespace-nowrap text-[0.76rem] text-[#8b96ad]">
              {[t.phone, t.email].filter(Boolean).join(" · ") || "no contact"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Stat({
  label, value, sub, tone,
}: {
  label: string; value: string; sub?: string; tone?: "ok" | "warn";
}) {
  const colour = tone === "ok" ? "text-[#0f8a5f]" : tone === "warn" ? "text-[#b26a00]" : "";
  return (
    <div className="rounded-[14px] border border-[#e3e7ee] bg-white p-[15px_18px] shadow-sm">
      <div className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-[#8b96ad]">{label}</div>
      <div className={`mt-1.5 font-display text-[1.5rem] font-semibold tabular-nums ${colour}`}>{value}</div>
      {sub && <div className="text-[0.78rem] text-[#8b96ad]">{sub}</div>}
    </div>
  );
}
