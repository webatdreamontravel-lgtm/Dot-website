import Link from "next/link";
import { RotateCcw } from "lucide-react";

import { requireAdmin } from "@/lib/auth";
import { getAdminRefunds, rupees } from "@/lib/queries/admin";
import type { AdminRefundRow } from "@/lib/queries/admin";
import { formatINR } from "@/lib/utils";
import { Chip, EmptyState, Panel } from "../ui";
import { FilterBar, FilterField, FilterSelect } from "../FilterBar";
import { Pagination } from "../Pagination";

export const metadata = { title: "Refunds" };

type SP = Promise<{ q?: string; status?: string; method?: string; page?: string }>;

/**
 * Where money going out is watched.
 *
 * A Razorpay refund is the one payment in this system that moves on someone
 * else's schedule: it is raised, then sits PENDING until a webhook says
 * otherwise — hours, sometimes never, if a delivery is missed. Until it
 * resolves it blocks a second refund and a carry-forward on that booking.
 *
 * All of that used to live inside the booking it belonged to, so a refund
 * that got stuck was invisible unless you already suspected it. Six had been
 * pending for days before anybody noticed.
 */
const STATUS_TONE: Record<string, { tone: string; label: string }> = {
  PENDING: { tone: "warn", label: "On its way" },
  PROCESSED: { tone: "ok", label: "Sent" },
  FAILED: { tone: "bad", label: "Failed" },
};

const METHOD_LABEL: Record<string, string> = {
  RAZORPAY: "Razorpay",
  CASH: "Cash",
  UPI: "UPI / GPay",
  BANK_TRANSFER: "Bank transfer",
  OTHER: "Other",
};

export default async function AdminRefundsPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const filters = await searchParams;
  const { rows, total, page, perPage, pageCount, pendingPaise, pendingCount, failedCount } =
    await getAdminRefunds(filters);

  const hasFilters = Boolean(filters.q || filters.status || filters.method);

  return (
    <>
      <header className="mb-6">
        <h1 className="font-display text-[1.85rem] font-semibold leading-tight tracking-tight">
          Refunds
        </h1>
        <p className="mt-0.5 text-[0.85rem] text-[#8b96ad]">
          Every rupee that has gone back, and everything still on its way.
        </p>
      </header>

      {/* Both figures are deliberately NOT filter-scoped: money in flight and
          refunds that failed are facts about the business, and they must not
          shrink because somebody typed a name in the search box. */}
      <div className="mb-5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          label="On its way back"
          value={formatINR(rupees(pendingPaise))}
          sub={
            pendingCount > 0
              ? `${pendingCount} refund${pendingCount === 1 ? "" : "s"} awaiting Razorpay`
              : "nothing in flight"
          }
          tone={pendingPaise > 0 ? "warn" : undefined}
        />
        <Stat
          label="Failed"
          value={String(failedCount)}
          sub={failedCount > 0 ? "money still with us — nobody was told" : "none"}
          tone={failedCount > 0 ? "bad" : undefined}
        />
        <Stat label="Refunds recorded" value={String(total)} sub={hasFilters ? "matching" : "all time"} />
      </div>

      <Panel>
        <FilterBar
          action="/admin/refunds"
          hasFilters={hasFilters}
          searchPlaceholder="Booking ref, customer or refund id…"
          table={
            rows.length === 0 ? (
              <EmptyState
                title={hasFilters ? "No refunds match those filters" : "No refunds yet"}
                body={
                  hasFilters
                    ? "Try clearing the status or method."
                    : "Money sent back from a booking screen appears here."
                }
              />
            ) : (
              <>
                <RefundTable rows={rows} />
                <Pagination
                  action="/admin/refunds"
                  page={page}
                  pageCount={pageCount}
                  total={total}
                  perPage={perPage}
                  noun="refunds"
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
                { value: "PENDING", label: "On its way" },
                { value: "PROCESSED", label: "Sent" },
                { value: "FAILED", label: "Failed" },
              ]}
            />
          </FilterField>
          <FilterField label="How">
            <FilterSelect
              name="method"
              value={filters.method}
              placeholder="Any method"
              options={Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label }))}
            />
          </FilterField>
        </FilterBar>
      </Panel>
    </>
  );
}

function RefundTable({ rows }: { rows: AdminRefundRow[] }) {
  const day = (d: Date) =>
    d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {["Booking", "Customer", "Amount", "Status", "How", "Raised", "Settled"].map((h) => (
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
          {rows.map((r) => {
            const tone = STATUS_TONE[r.status] ?? { tone: "mute", label: r.status };
            return (
              <tr key={r.id} className="hover:bg-[#fafbfd]">
                <td className="whitespace-nowrap border-b border-[#eef1f6] px-4 py-3">
                  <Link
                    href={`/admin/bookings/${r.booking.reference}`}
                    className="font-mono text-[0.8rem] font-medium text-[#5a6785] underline-offset-2 hover:text-navy hover:underline"
                  >
                    {r.booking.reference}
                  </Link>
                  <div className="max-w-[20ch] truncate text-[0.75rem] text-[#8b96ad]">
                    {r.booking.trip.title}
                  </div>
                </td>
                <td className="border-b border-[#eef1f6] px-4 py-3">
                  <div className="text-[0.85rem] text-navy">
                    {r.booking.profile.fullName ?? "—"}
                  </div>
                  <div className="max-w-[22ch] truncate text-[0.75rem] text-[#8b96ad]">
                    {r.booking.profile.email}
                  </div>
                </td>
                <td className="whitespace-nowrap border-b border-[#eef1f6] px-4 py-3 font-display text-[0.95rem] font-semibold tabular-nums">
                  {formatINR(rupees(r.amountPaise))}
                </td>
                <td className="border-b border-[#eef1f6] px-4 py-3">
                  <Chip tone={tone.tone}>{tone.label}</Chip>
                  {/* The reason a failure happened is the whole point of
                      showing it — a FAILED row with no explanation just
                      moves the question somewhere else. */}
                  {r.failureReason && (
                    <div className="mt-1 max-w-[26ch] text-[0.72rem] leading-snug text-[#c33a3a]">
                      {r.failureReason}
                    </div>
                  )}
                </td>
                <td className="whitespace-nowrap border-b border-[#eef1f6] px-4 py-3 text-[0.83rem] text-[#5a6785]">
                  {METHOD_LABEL[r.method] ?? r.method}
                  {(r.razorpayRefundId || r.externalReference) && (
                    <div className="max-w-[18ch] truncate font-mono text-[0.7rem] text-[#a8b0c0]">
                      {r.razorpayRefundId ?? r.externalReference}
                    </div>
                  )}
                </td>
                <td className="whitespace-nowrap border-b border-[#eef1f6] px-4 py-3 text-[0.8rem] text-[#8b96ad]">
                  {day(r.createdAt)}
                </td>
                <td className="whitespace-nowrap border-b border-[#eef1f6] px-4 py-3 text-[0.8rem]">
                  {r.processedAt ? (
                    <span className="text-[#8b96ad]">{day(r.processedAt)}</span>
                  ) : r.status === "PENDING" ? (
                    <span className="inline-flex items-center gap-1 font-medium text-[#8b6a00]">
                      <RotateCcw className="h-3 w-3 flex-none" aria-hidden /> waiting
                    </span>
                  ) : (
                    <span className="text-[#c3cad8]">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Stat({
  label, value, sub, tone,
}: { label: string; value: string; sub?: string; tone?: "ok" | "warn" | "bad" }) {
  const colour =
    tone === "ok" ? "text-[#0f8a5f]" : tone === "warn" ? "text-[#b26a00]" : tone === "bad" ? "text-[#c33a3a]" : "";
  return (
    <div className="rounded-[14px] border border-[#e3e7ee] bg-white p-[15px_18px] shadow-sm">
      <div className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-[#8b96ad]">{label}</div>
      <div className={`mt-1.5 font-display text-[1.5rem] font-semibold tabular-nums ${colour}`}>{value}</div>
      {sub && <div className="mt-1 text-[0.75rem] text-[#8b96ad]">{sub}</div>}
    </div>
  );
}
