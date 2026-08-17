import Link from "next/link";

import { requireAdmin } from "@/lib/auth";
import { getAdminCustomers, getCustomerCities, rupees } from "@/lib/queries/admin";
import type { AdminCustomerRow } from "@/lib/queries/admin";
import { formatINR } from "@/lib/utils";
import { Chip, EmptyState, Panel } from "../ui";
import { FilterBar, FilterField, FilterSelect } from "../FilterBar";
import { Pagination } from "../Pagination";

export const metadata = { title: "Customers" };

type SP = Promise<{ q?: string; city?: string; hasBookings?: string; page?: string }>;

export default async function AdminCustomersPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const filters = await searchParams;

  const [{ rows, total, page, perPage, pageCount }, cities] = await Promise.all([
    getAdminCustomers(filters),
    getCustomerCities(),
  ]);

  const hasFilters = Boolean(filters.q || filters.city || filters.hasBookings);

  return (
    <>
      <header className="mb-6">
        <h1 className="font-display text-[1.85rem] font-semibold tracking-tight">Customers</h1>
        <p className="mt-0.5 text-[0.85rem] text-[#8b96ad]">
          {total} {hasFilters ? "matching" : "signed up"}
        </p>
      </header>

      <Panel>
        <FilterBar
          action="/admin/customers"
          hasFilters={hasFilters}
          searchPlaceholder="Name, email or phone…"
          table={
            rows.length === 0 ? (
              <EmptyState
                title={hasFilters ? "No customers match those filters" : "No customers yet"}
                body={
                  hasFilters
                    ? "Try clearing the city filter."
                    : "Anyone who creates an account appears here."
                }
              />
            ) : (
              <>
                <CustomerTable rows={rows} />
                <Pagination
                  action="/admin/customers"
                  page={page}
                  pageCount={pageCount}
                  total={total}
                  perPage={perPage}
                  noun="customers"
                />
              </>
            )
          }
        >
          <FilterField label="City">
            <FilterSelect
              name="city"
              value={filters.city}
              placeholder="Any city"
              options={cities.map((c) => ({ value: c, label: c }))}
            />
          </FilterField>
          <FilterField label="Bookings">
            <FilterSelect
              name="hasBookings"
              value={filters.hasBookings}
              placeholder="Any"
              options={[
                { value: "yes", label: "Has booked" },
                { value: "no", label: "Never booked" },
              ]}
            />
          </FilterField>
        </FilterBar>
      </Panel>
    </>
  );
}

function CustomerTable({ rows }: { rows: AdminCustomerRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {["Customer", "Contact", "From", "Bookings", "Seats", "Value", "Paid", "Joined"].map((h) => (
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
          {rows.map((c) => (
            <tr key={c.id} className="hover:bg-[#fafbfd]">
              <td className="border-b border-[#eef1f6] px-4 py-3">
                <Link href={`/admin/customers/${c.id}`} className="block">
                  <div className="text-[0.89rem] font-semibold text-navy">
                    {c.fullName ?? "—"}
                  </div>
                  <div className="flex items-center gap-1.5 text-[0.78rem] text-[#8b96ad]">
                    {c.emailVerified ? (
                      <span className="text-[#0f8a5f]">✓ verified</span>
                    ) : (
                      <span className="text-[#b26a00]">unverified</span>
                    )}
                  </div>
                </Link>
              </td>
              <td className="border-b border-[#eef1f6] px-4 py-3">
                <div className="text-[0.83rem] text-navy">{c.phone ?? "—"}</div>
                <div className="text-[0.78rem] text-[#8b96ad]">{c.email}</div>
              </td>
              <td className="border-b border-[#eef1f6] px-4 py-3 text-[0.83rem] text-[#5a6785]">
                {c.city ?? "—"}
              </td>
              <td className="border-b border-[#eef1f6] px-4 py-3">
                {c.bookingCount > 0 ? (
                  <Link
                    href={`/admin/customers/${c.id}`}
                    className="text-[0.85rem] tabular-nums underline-offset-2 hover:underline"
                  >
                    {c.bookingCount}
                  </Link>
                ) : (
                  <Chip tone="mute">None</Chip>
                )}
              </td>
              <td className="border-b border-[#eef1f6] px-4 py-3 text-[0.85rem] tabular-nums">
                {c.seats}
              </td>
              <td className="whitespace-nowrap border-b border-[#eef1f6] px-4 py-3 font-display text-[0.92rem] font-semibold tabular-nums">
                {formatINR(rupees(c.totalPaise))}
              </td>
              <td className="whitespace-nowrap border-b border-[#eef1f6] px-4 py-3 font-display text-[0.92rem] font-semibold tabular-nums text-[#0f8a5f]">
                {formatINR(rupees(c.paidPaise))}
              </td>
              <td className="whitespace-nowrap border-b border-[#eef1f6] px-4 py-3 text-[0.8rem] text-[#8b96ad]">
                {c.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
