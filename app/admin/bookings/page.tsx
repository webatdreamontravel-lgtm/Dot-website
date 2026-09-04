import Link from "next/link";

import { requireAdmin } from "@/lib/auth";
import { getAdminBookings, getTripOptions, rupees } from "@/lib/queries/admin";
import { formatINR } from "@/lib/utils";
import { BOOKING_TONE, bookingTone, Chip, EmptyState, PAYMENT_TONE, Panel } from "../ui";
import { FilterBar, FilterField, FilterSelect } from "../FilterBar";
import { Pagination } from "../Pagination";

export const metadata = { title: "Bookings" };

type SP = Promise<{
  q?: string; tripId?: string; status?: string; payment?: string; source?: string; page?: string;
}>;

export default async function AdminBookingsPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const filters = await searchParams;

  const [bookings, trips] = await Promise.all([
    getAdminBookings(filters),
    getTripOptions(),
  ]);

  const { totals } = bookings;
  const hasFilters = Boolean(
    filters.q || filters.tripId || filters.status || filters.payment || filters.source,
  );

  return (
    <>
      <header className="mb-6 flex flex-wrap items-center gap-4">
        <div>
          <h1 className="font-display text-[1.85rem] font-semibold tracking-tight">Bookings</h1>
          {/* Money is summed across every match, not just the rows on screen —
              a per-page figure would quietly shrink as you paginate. */}
          <p className="mt-0.5 text-[0.85rem] text-[#8b96ad]">
            {totals.count} {hasFilters ? "matching" : "total"} ·{" "}
            {formatINR(rupees(totals.collectedPaise))} collected of{" "}
            {formatINR(rupees(totals.totalPaise))}
          </p>
        </div>
      </header>

      <Panel>
        <FilterBar
          action="/admin/bookings"
          hasFilters={hasFilters}
          searchPlaceholder="Name, phone, email or reference…"
          table={
            bookings.rows.length === 0 ? (
              <EmptyState
                title={hasFilters ? "No bookings match those filters" : "No bookings yet"}
                body={
                  hasFilters
                    ? "Try widening the search — clearing the trip or payment filter usually does it."
                    : "Bookings will appear here the moment someone books from the site, or when you add one manually."
                }
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        {["Reference", "Customer", "Trip", "Status", "Seats", "Total", "Held", "Balance", "Payment", "Source", "Booked"].map((h) => (
                          <th key={h} className="whitespace-nowrap border-b border-[#e3e7ee] bg-[#fbfcfe] px-4 py-2.5 text-left text-[0.72rem] font-semibold uppercase tracking-[0.09em] text-[#8b96ad]">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.rows.map((b) => {
                        const status = bookingTone(b);
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
                            <td className="border-b border-[#eef1f6] px-4 py-3 text-[0.85rem]">{b.trip.title}</td>
                            <td className="border-b border-[#eef1f6] px-4 py-3"><Chip tone={status.tone}>{status.label}</Chip></td>
                            <td className="border-b border-[#eef1f6] px-4 py-3 text-[0.85rem] tabular-nums">{b.seats}</td>
                            <td className="whitespace-nowrap border-b border-[#eef1f6] px-4 py-3 font-display text-[0.95rem] font-semibold tabular-nums">
                              {formatINR(rupees(b.totalPaise))}
                            </td>
                            {/* Net, not gross: what this booking is actually
                                holding. The refund is spelled out underneath
                                so the arithmetic is visible rather than
                                mysterious. */}
                            <td className="whitespace-nowrap border-b border-[#eef1f6] px-4 py-3 tabular-nums">
                              <span className="font-display text-[0.95rem] font-semibold text-[#0f8a5f]">
                                {formatINR(rupees(b.netHeldPaise))}
                              </span>
                              {(b.refundedPaise > 0 || b.creditIssuedPaise > 0) && (
                                <span className="mt-0.5 block text-[0.72rem] font-normal text-[#8b96ad]">
                                  {formatINR(rupees(b.amountPaidPaise))}
                                  {b.refundedPaise > 0 && ` − ${formatINR(rupees(b.refundedPaise))}`}
                                  {b.creditIssuedPaise > 0 && ` − ${formatINR(rupees(b.creditIssuedPaise))} credit`}
                                </span>
                              )}
                            </td>
                            {/* One column, both directions. An overpaid
                                booking used to show "—" here, which is how
                                ₹100 owed to a customer stays invisible. */}
                            <td
                              className={`whitespace-nowrap border-b border-[#eef1f6] px-4 py-3 tabular-nums ${
                                b.overpaidPaise > 0
                                  ? "text-[#b26a00]"
                                  : b.balancePaise > 0
                                    ? "text-[#b26a00]"
                                    : "text-[#8b96ad]"
                              }`}
                            >
                              {b.overpaidPaise > 0 ? (
                                <>
                                  <span className="font-display text-[0.95rem] font-semibold">
                                    {formatINR(rupees(b.overpaidPaise))}
                                  </span>
                                  <span className="mt-0.5 block text-[0.72rem] font-normal">
                                    to refund
                                  </span>
                                </>
                              ) : b.balancePaise > 0 ? (
                                <span className="font-display text-[0.95rem] font-semibold">
                                  {formatINR(rupees(b.balancePaise))}
                                </span>
                              ) : (
                                "—"
                              )}
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
                  action="/admin/bookings"
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
          <FilterField label="Trip">
            <FilterSelect
              name="tripId"
              value={filters.tripId}
              placeholder="All trips"
              options={trips.map((t) => ({ value: t.id, label: t.title }))}
            />
          </FilterField>
          <FilterField label="Status">
            <FilterSelect
              name="status"
              value={filters.status}
              placeholder="Any status"
              options={Object.entries(BOOKING_TONE).map(([value, v]) => ({ value, label: v.label }))}
            />
          </FilterField>
          <FilterField label="Payment">
            <FilterSelect
              name="payment"
              value={filters.payment}
              placeholder="Any payment"
              options={Object.entries(PAYMENT_TONE).map(([value, v]) => ({ value, label: v.label }))}
            />
          </FilterField>
          <FilterField label="Source">
            <FilterSelect
              name="source"
              value={filters.source}
              placeholder="Any source"
              options={[
                { value: "WEB", label: "Website" },
                { value: "ADMIN_OFFLINE", label: "Offline" },
                { value: "WHATSAPP", label: "WhatsApp" },
                { value: "FESTIVAL", label: "Festival" },
              ]}
            />
          </FilterField>
        </FilterBar>
      </Panel>
    </>
  );
}
