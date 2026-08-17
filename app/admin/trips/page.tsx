import Link from "next/link";

import { requireAdmin } from "@/lib/auth";
import { countLiveTrips, getAdminTrips, rupees } from "@/lib/queries/admin";
import type { AdminTripRow } from "@/lib/queries/admin";
import { formatINR } from "@/lib/utils";
import { Chip, EmptyState, Panel, TRIP_TONE } from "../ui";
import { FilterBar, FilterField, FilterSelect, filterInputClass } from "../FilterBar";
import { Pagination } from "../Pagination";
import { TripRowMenu } from "./TripRowMenu";

export const metadata = { title: "Trips" };

type SP = Promise<{ q?: string; status?: string; from?: string; to?: string; page?: string }>;

export default async function AdminTripsPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const filters = await searchParams;

  const [{ rows: trips, total, page, perPage, pageCount }, live] = await Promise.all([
    getAdminTrips(filters),
    // Counted across the whole table, not the current page — "live on the
    // site" is a fact about the site, not about what you've filtered to.
    countLiveTrips(),
  ]);

  const hasFilters = Boolean(filters.q || filters.status || filters.from || filters.to);

  return (
    <>
      <header className="mb-6 flex flex-wrap items-center gap-4">
        <div>
          <h1 className="font-display text-[1.85rem] font-semibold tracking-tight">Trips</h1>
          <p className="mt-0.5 text-[0.85rem] text-[#8b96ad]">
            {total} {hasFilters ? "matching" : "total"} · {live} live on the site
          </p>
        </div>
        <Link
          href="/admin/trips/new"
          className="ml-auto rounded-lg bg-navy px-3.5 py-2 text-[0.85rem] font-medium text-cream hover:bg-[#1b2f56]"
        >
          + New trip
        </Link>
      </header>

      <Panel>
        <FilterBar
          action="/admin/trips"
          hasFilters={hasFilters}
          searchPlaceholder="Trip name, batch, destination…"
          table={
            trips.length === 0 ? (
              <EmptyState
                title={hasFilters ? "No trips match those filters" : "No trips yet"}
                body={
                  hasFilters
                    ? "Try clearing the date range — it's the filter that most often hides everything."
                    : "Create your first trip and it'll appear on the landing page as soon as you publish it."
                }
                action={
                  <Link
                    href={hasFilters ? "/admin/trips" : "/admin/trips/new"}
                    className="inline-block rounded-lg bg-navy px-3.5 py-2 text-[0.85rem] font-medium text-cream"
                  >
                    {hasFilters ? "Clear filters" : "Create a trip"}
                  </Link>
                }
              />
            ) : (
              <>
                <TripTable trips={trips} />
                <Pagination
                  action="/admin/trips"
                  page={page}
                  pageCount={pageCount}
                  total={total}
                  perPage={perPage}
                  noun="trips"
                />
              </>
            )
          }
        >
          <FilterField label="Status">
            <FilterSelect
              name="status"
              value={filters.status}
              placeholder="Any status"
              options={[
                { value: "PUBLISHED", label: "Live" },
                { value: "DRAFT", label: "Draft" },
                { value: "ARCHIVED", label: "Archived" },
              ]}
            />
          </FilterField>
          <FilterField label="Departs from">
            <input type="date" name="from" defaultValue={filters.from ?? ""} className={filterInputClass} />
          </FilterField>
          <FilterField label="Departs before">
            <input type="date" name="to" defaultValue={filters.to ?? ""} className={filterInputClass} />
          </FilterField>
        </FilterBar>
      </Panel>
    </>
  );
}

function TripTable({ trips }: { trips: AdminTripRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {["Trip", "Batch", "Dates", "Status", "Seats", "Price", "Payments", "Bookings", ""].map((h) => (
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
          {trips.map((t) => {
            const pctFull = Math.round((t.seatsBooked / t.totalSeats) * 100);
            const tone = TRIP_TONE[t.status];
            return (
              <tr key={t.id} className="hover:bg-[#fafbfd]">
                <td className="border-b border-[#eef1f6] px-4 py-3">
                  <Link href={`/admin/trips/${t.id}`} className="block">
                    <div className="text-[0.89rem] font-semibold">{t.title}</div>
                    {/* The batch name is what tells apart three runs of
                        the same trip, so it gets prominence over the
                        category. */}
                    <div className="text-[0.78rem] text-[#8b96ad]">
                      {t.category ?? "Uncategorised"}
                    </div>
                  </Link>
                </td>
                <td className="border-b border-[#eef1f6] px-4 py-3">
                  {t.batchName ? (
                    <span className="inline-block rounded bg-[#eef1f6] px-2 py-1 text-[0.78rem] font-medium text-[#5a6785]">
                      {t.batchName}
                    </span>
                  ) : (
                    <span className="text-[0.8rem] text-[#c3cad8]">—</span>
                  )}
                </td>
                <td className="whitespace-nowrap border-b border-[#eef1f6] px-4 py-3 text-[0.83rem]">
                  {t.startDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                  {t.departed && <div className="text-[0.75rem] font-medium text-[#c33a3a]">departed</div>}
                </td>
                <td className="border-b border-[#eef1f6] px-4 py-3">
                  <Chip tone={tone.tone}>{tone.label}</Chip>
                </td>
                <td className="whitespace-nowrap border-b border-[#eef1f6] px-4 py-3">
                  <div className="text-[0.85rem] font-semibold tabular-nums">
                    {t.seatsBooked}/{t.totalSeats}
                  </div>
                  <div className="mt-1 h-[5px] w-20 overflow-hidden rounded-full bg-[#e3e7ee]">
                    <div
                      className={`h-full rounded-full ${pctFull >= 100 ? "bg-[#c33a3a]" : pctFull >= 65 ? "bg-[#b26a00]" : "bg-teal"}`}
                      style={{ width: `${Math.min(pctFull, 100)}%` }}
                    />
                  </div>
                </td>
                <td className="whitespace-nowrap border-b border-[#eef1f6] px-4 py-3 font-display text-[0.95rem] font-semibold tabular-nums">
                  {formatINR(rupees(t.pricePaise))}
                </td>
                <td className="border-b border-[#eef1f6] px-4 py-3">
                  {t.razorpayEnabled ? <Chip tone="ok">Razorpay on</Chip> : <Chip tone="mute">Requests only</Chip>}
                </td>
                <td className="border-b border-[#eef1f6] px-4 py-3">
                  <Link
                    href={`/admin/trips/${t.id}/bookings`}
                    className="text-[0.85rem] tabular-nums underline-offset-2 hover:underline"
                  >
                    {t.bookingCount}
                  </Link>
                </td>
                <td className="border-b border-[#eef1f6] px-4 py-3">
                  <TripRowMenu
                    tripId={t.id}
                    slug={t.slug}
                    isPublished={t.status === "PUBLISHED"}
                    bookingCount={t.bookingCount}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
