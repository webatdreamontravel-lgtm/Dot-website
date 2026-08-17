import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireAdmin } from "@/lib/auth";
import {
  getAdminCustomer,
  getCustomerBookings,
  getCustomerStats,
  rupees,
  type CustomerStats,
} from "@/lib/queries/admin";
import { formatINR } from "@/lib/utils";
import { BOOKING_TONE, Chip, EmptyState, PAYMENT_TONE, Panel } from "../../ui";
import { FilterBar, FilterField, FilterSelect, filterInputClass } from "../../FilterBar";
import { Pagination } from "../../Pagination";
import { Tabs } from "../../Tabs";

export const metadata = { title: "Customer" };

type SP = Promise<{
  tab?: string; q?: string; status?: string; payment?: string;
  from?: string; to?: string; page?: string;
}>;

const METHOD_LABEL: Record<string, string> = {
  CASH: "Cash",
  UPI_MANUAL: "UPI",
  BANK_TRANSFER: "Bank transfer",
  RAZORPAY: "Razorpay",
  OTHER: "Other",
};

export default async function AdminCustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SP;
}) {
  await requireAdmin();
  const { id } = await params;
  const filters = await searchParams;

  const customer = await getAdminCustomer(id);
  if (!customer) notFound();

  const stats = await getCustomerStats(id);
  const tab = filters.tab === "bookings" ? "bookings" : "overview";
  const base = `/admin/customers/${id}`;

  return (
    <>
      <header className="mb-6">
        <Link
          href="/admin/customers"
          className="mb-1 inline-flex items-center gap-1.5 text-[0.82rem] text-[#5a6785] hover:text-navy"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All customers
        </Link>
        <h1 className="font-display text-[1.85rem] font-semibold leading-tight tracking-tight">
          {customer.fullName ?? customer.email}
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-[0.85rem] text-[#8b96ad]">
          {customer.emailVerified ? (
            <Chip tone="ok">Email verified</Chip>
          ) : (
            <Chip tone="warn">Not verified</Chip>
          )}
          {customer.role === "ADMIN" && <Chip tone="info">Admin</Chip>}
          <span>
            Joined{" "}
            {customer.createdAt.toLocaleDateString("en-IN", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        </p>
      </header>

      <Tabs
        basePath={base}
        active={tab}
        tabs={[
          { key: "overview", label: "Overview" },
          { key: "bookings", label: "Bookings", count: stats.bookings },
        ]}
      />

      {tab === "overview" ? (
        <Overview customer={customer} stats={stats} base={base} />
      ) : (
        <BookingsTab customerId={id} filters={filters} base={base} />
      )}
    </>
  );
}

async function Overview({
  customer,
  stats,
  base,
}: {
  customer: NonNullable<Awaited<ReturnType<typeof getAdminCustomer>>>;
  stats: CustomerStats;
  base: string;
}) {
  const age = customer.dateOfBirth ? yearsSince(customer.dateOfBirth) : null;

  return (
    <>
      <div className="mb-5 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Bookings" value={String(stats.bookings)} sub={stats.cancelled > 0 ? `${stats.cancelled} cancelled` : undefined} />
        <Stat label="Seats taken" value={String(stats.seats)} sub={`across ${stats.tripsBooked} trip${stats.tripsBooked === 1 ? "" : "s"}`} />
        <Stat label="Paid" value={formatINR(rupees(stats.paidPaise))} tone="ok" sub={`of ${formatINR(rupees(stats.totalPaise))}`} />
        <Stat
          label="Outstanding"
          value={formatINR(rupees(stats.outstandingPaise))}
          tone={stats.outstandingPaise > 0 ? "warn" : undefined}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <Panel title="Details">
          <dl className="px-5 py-4 text-[0.87rem]">
            <Row label="Email" value={customer.email} />
            <Row label="Phone" value={customer.phone ?? "—"} />
            <Row label="City" value={customer.city ?? "—"} />
            <Row label="State" value={customer.state ?? "—"} />
            <Row label="Gender" value={customer.gender ? title(customer.gender) : "—"} />
            <Row
              label="Date of birth"
              value={
                customer.dateOfBirth
                  ? `${customer.dateOfBirth.toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      timeZone: "UTC",
                    })}${age !== null ? ` · ${age}` : ""}`
                  : "—"
              }
            />
          </dl>
        </Panel>

        <Panel title="Booking activity">
          <dl className="px-5 py-4 text-[0.87rem]">
            <Row label="First booked" value={stats.firstBookedAt ? longDate(stats.firstBookedAt) : "Never"} />
            <Row label="Most recent" value={stats.lastBookedAt ? longDate(stats.lastBookedAt) : "—"} />
            <Row
              label="Average booking"
              value={stats.averagePaise > 0 ? formatINR(rupees(stats.averagePaise)) : "—"}
            />
            <Row
              label="Cancellations"
              value={
                stats.bookings > 0
                  ? `${stats.cancelled} of ${stats.bookings}`
                  : "—"
              }
            />
          </dl>
        </Panel>

        <Panel title="How they've paid">
          {stats.methods.length === 0 ? (
            <p className="px-5 py-6 text-center text-[0.86rem] text-[#8b96ad]">
              No payments recorded yet.
            </p>
          ) : (
            <ul className="divide-y divide-[#eef1f6]">
              {stats.methods
                .slice()
                .sort((a, b) => b.totalPaise - a.totalPaise)
                .map((m) => (
                  <li key={m.method} className="flex items-baseline justify-between gap-3 px-5 py-3">
                    <span className="text-[0.87rem] text-navy">
                      {METHOD_LABEL[m.method] ?? m.method}
                      <span className="ml-2 text-[0.78rem] text-[#8b96ad]">
                        {m.count} payment{m.count === 1 ? "" : "s"}
                      </span>
                    </span>
                    <span className="font-display text-[0.95rem] font-semibold tabular-nums text-navy">
                      {formatINR(rupees(m.totalPaise))}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </Panel>

        <Panel title="Bookings">
          <div className="px-5 py-6 text-center">
            <p className="text-[0.87rem] text-[#5a6785]">
              {stats.bookings === 0
                ? "They've created an account but haven't booked a trip."
                : `${stats.bookings} booking${stats.bookings === 1 ? "" : "s"} — search and filter them on the Bookings tab.`}
            </p>
            {stats.bookings > 0 && (
              <Link
                href={`${base}?tab=bookings`}
                className="mt-3 inline-block rounded-lg bg-navy px-3.5 py-2 text-[0.85rem] font-medium text-cream hover:bg-[#1b2f56]"
              >
                View bookings
              </Link>
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}

async function BookingsTab({
  customerId,
  filters,
  base,
}: {
  customerId: string;
  filters: Awaited<SP>;
  base: string;
}) {
  const { rows, total, page, perPage, pageCount } = await getCustomerBookings(customerId, filters);
  const hasFilters = Boolean(
    filters.q || filters.status || filters.payment || filters.from || filters.to,
  );

  return (
    <Panel>
      <FilterBar
        action={base}
        hasFilters={hasFilters}
        searchPlaceholder="Booking ref, trip or batch…"
        table={
          rows.length === 0 ? (
            <EmptyState
              title={hasFilters ? "No bookings match those filters" : "No bookings yet"}
              body={
                hasFilters
                  ? "Try clearing the date range or payment filter."
                  : "They've created an account but haven't booked a trip."
              }
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      {["Ref", "Trip", "Seats", "Total", "Paid", "Balance", "Payment", "Status", "Booked"].map((h) => (
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
                    {rows.map((b) => {
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
                            <div className="text-[0.86rem] font-medium text-navy">{b.trip.title}</div>
                            <div className="whitespace-nowrap text-[0.78rem] text-[#8b96ad]">
                              {b.trip.batchName ??
                                b.trip.startDate.toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                            </div>
                          </td>
                          <td className="border-b border-[#eef1f6] px-4 py-3 text-[0.85rem] tabular-nums">
                            {b.seats}
                          </td>
                          <td className="whitespace-nowrap border-b border-[#eef1f6] px-4 py-3 font-display text-[0.92rem] font-semibold tabular-nums">
                            {formatINR(rupees(b.totalPaise))}
                          </td>
                          <td className="whitespace-nowrap border-b border-[#eef1f6] px-4 py-3 font-display text-[0.92rem] font-semibold tabular-nums text-[#0f8a5f]">
                            {formatINR(rupees(b.amountPaidPaise))}
                          </td>
                          <td
                            className={`whitespace-nowrap border-b border-[#eef1f6] px-4 py-3 font-display text-[0.92rem] font-semibold tabular-nums ${b.balancePaise > 0 ? "text-[#b26a00]" : "text-[#8b96ad]"}`}
                          >
                            {b.balancePaise > 0 ? formatINR(rupees(b.balancePaise)) : "—"}
                          </td>
                          <td className="border-b border-[#eef1f6] px-4 py-3">
                            <Chip tone={pay.tone}>{pay.label}</Chip>
                          </td>
                          <td className="border-b border-[#eef1f6] px-4 py-3">
                            <Chip tone={status.tone}>{status.label}</Chip>
                          </td>
                          <td className="whitespace-nowrap border-b border-[#eef1f6] px-4 py-3 text-[0.8rem] text-[#8b96ad]">
                            {b.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination
                action={base}
                page={page}
                pageCount={pageCount}
                total={total}
                perPage={perPage}
                noun="bookings"
              />
            </>
          )
        }
      >
        {/* Keeps the tab in the URL when the filter form rebuilds it — without
            this, applying a filter would bounce back to the Overview tab. */}
        <input type="hidden" name="tab" value="bookings" />

        <FilterField label="Status">
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
        <FilterField label="Booked from">
          <input type="date" name="from" defaultValue={filters.from ?? ""} className={filterInputClass} />
        </FilterField>
        <FilterField label="Booked to">
          <input type="date" name="to" defaultValue={filters.to ?? ""} className={filterInputClass} />
        </FilterField>
      </FilterBar>
    </Panel>
  );
}

const title = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

const longDate = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

function yearsSince(dob: Date) {
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age -= 1;
  return age;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <dt className="text-[#8b96ad]">{label}</dt>
      <dd className="text-right text-navy">{value}</dd>
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
      {sub && <div className="text-[0.78rem] text-[#8b96ad]">{sub}</div>}
    </div>
  );
}
