import Link from "next/link";
import { AlertTriangle, Landmark } from "lucide-react";

import { requireAdmin } from "@/lib/auth";
import { isTestMode, paymentsConfigured } from "@/lib/payments/client";
import { rupees } from "@/lib/queries/admin";
import {
  getSettlement,
  listSettlements,
  settlementTone,
  type Settlement,
} from "@/lib/queries/settlements";
import { formatINR } from "@/lib/utils";
import { Chip, EmptyState, Panel } from "../ui";
import { DateRangeField } from "@/components/shared/DateRangeField";
import { FilterBar } from "../FilterBar";
import { SettlementPager } from "./SettlementPager";

export const metadata = { title: "Settlements" };

/**
 * What Razorpay has actually paid into the bank.
 *
 * Payments and refunds show money moving on a booking; this shows money
 * arriving. Until now the only way to answer "did Tuesday's bookings land, and
 * what were they" was the Razorpay dashboard plus matching UTRs by hand.
 *
 * The filters are thin because the API is thin: `from`, `to`, `count`, `skip`
 * is the whole of it. There is no status filter and no free-text search — the
 * search box does a fetch-by-id, which is the only lookup Razorpay offers. It
 * would be easy to add a status dropdown that filtered the rows already on
 * screen, and deeply misleading: "no failures" would mean "none on this page".
 */
type SP = Promise<{ q?: string; from?: string; to?: string; page?: string }>;

/** One bounded call on first paint, rather than every settlement ever made. */
function defaultRange() {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 86_400_000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

export default async function AdminSettlementsPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const filters = await searchParams;

  if (!paymentsConfigured()) {
    return (
      <Shell>
        <Panel title="Razorpay isn't configured">
          <div className="px-5 py-6 text-[0.88rem] leading-relaxed text-[#5a6785]">
            Set <code className="rounded bg-[#f1f4f8] px-1.5 py-0.5">RAZORPAY_KEY_ID</code> and{" "}
            <code className="rounded bg-[#f1f4f8] px-1.5 py-0.5">RAZORPAY_KEY_SECRET</code> and
            restart. Nothing else in the admin depends on this screen.
          </div>
        </Panel>
      </Shell>
    );
  }

  const id = filters.q?.trim();
  const range = { from: filters.from || defaultRange().from, to: filters.to || defaultRange().to };
  const page = Math.max(Number(filters.page) || 1, 1);

  let rows: Settlement[] = [];
  let hasMore = false;
  let error: string | null = null;
  // An id in the search box is a lookup, not a filter — Razorpay has a
  // separate endpoint for it, and the date range does not apply.
  let lookedUp = false;

  try {
    if (id) {
      lookedUp = true;
      const one = await getSettlement(id);
      rows = one ? [one] : [];
    } else {
      const res = await listSettlements({ ...range, page });
      rows = res.rows;
      hasMore = res.hasMore;
    }
  } catch (e) {
    // Razorpay being down must not take the admin panel with it.
    error = e instanceof Error ? e.message : String(e);
  }

  const settled = rows.reduce((n, r) => n + r.amount, 0);
  const fees = rows.reduce((n, r) => n + (r.fees ?? 0), 0);

  return (
    <Shell>
      {isTestMode() && (
        <p
          role="alert"
          className="mb-5 flex items-start gap-2 rounded-xl border border-[#f0dcae] bg-[#fdf6e3] px-4 py-3 text-[0.85rem] text-[#7a4a00]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
          Test mode. These settlements are Razorpay&rsquo;s sandbox data — no money has moved.
        </p>
      )}

      {/* Scoped to what's on screen, and labelled as such. Unlike the refunds
          stats these CANNOT be computed for the whole business without walking
          every page of the API, so claiming otherwise would be a lie. */}
      <div className="mb-5 grid gap-3.5 sm:grid-cols-2">
        <Stat
          label={lookedUp ? "This settlement" : "Settled in this range"}
          value={formatINR(rupees(settled))}
          sub={`${rows.length} settlement${rows.length === 1 ? "" : "s"} shown`}
        />
        <Stat label="Razorpay fees" value={formatINR(rupees(fees))} sub="Including tax, on the rows shown" />
      </div>

      <Panel title="Settlements">
        <FilterBar
          action="/admin/settlements"
          hasFilters={Boolean(filters.q || filters.from || filters.to)}
          searchPlaceholder="Settlement ID"
          // Search and the date range split the row evenly: one is a
          // fetch-by-id escape hatch, the other the primary filter, and
          // neither should dominate.
          evenFields
          table={
            error ? (
              <div className="px-5 py-8 text-center text-[0.88rem] text-[#c33a3a]">
                Couldn&rsquo;t reach Razorpay: {error}
              </div>
            ) : rows.length === 0 ? (
              <EmptyState
                title={lookedUp ? "No settlement with that ID" : "No settlements in this range"}
                body={
                  lookedUp
                    ? "Check the ID — settlement references look like setl_ABC123."
                    : "Razorpay settles on a T+2 cycle, so a new account may have none yet."
                }
              />
            ) : (
              <>
                <Table rows={rows} />
                {!lookedUp && (
                  <SettlementPager page={page} hasMore={hasMore} shown={rows.length} />
                )}
              </>
            )
          }
        >
          {/* One range control rather than two date inputs. Deliberately
              disabled during an ID lookup: the dates do not apply to
              fetch-by-id, and leaving it live implies they do. */}
          <DateRangeField
            label="Settled between"
            from={filters.from ?? range.from}
            to={filters.to ?? range.to}
            disabled={lookedUp}
            className="min-w-[190px] flex-1"
          />
        </FilterBar>
      </Panel>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="mb-6">
        <h1 className="flex items-center gap-2.5 font-display text-[1.85rem] font-semibold leading-tight tracking-tight">
          <Landmark className="h-6 w-6 text-[#8b96ad]" />
          Settlements
        </h1>
        <p className="mt-0.5 text-[0.85rem] text-[#8b96ad]">
          What Razorpay has paid out, and which bookings each payout covered.
        </p>
      </header>
      {children}
    </>
  );
}

function Table({ rows }: { rows: Settlement[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-[0.87rem]">
        <thead>
          <tr className="border-b border-[#e3e7ee] text-left text-[0.74rem] uppercase tracking-[0.08em] text-[#8b96ad]">
            <th className="px-5 py-2.5 font-semibold">Settled on</th>
            <th className="px-5 py-2.5 font-semibold">Settlement</th>
            <th className="px-5 py-2.5 text-right font-semibold">Amount</th>
            <th className="px-5 py-2.5 text-right font-semibold">Fees</th>
            <th className="px-5 py-2.5 font-semibold">UTR</th>
            <th className="px-5 py-2.5 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const { tone, label } = settlementTone(s.status);
            return (
              <tr key={s.id} className="border-b border-[#eef1f6] last:border-0 hover:bg-[#fbfcfe]">
                <td className="whitespace-nowrap px-5 py-3 text-[#5a6785]">
                  {s.createdAt.toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
                <td className="px-5 py-3">
                  <Link
                    href={`/admin/settlements/${s.id}`}
                    className="font-medium text-navy underline underline-offset-4 hover:text-teal"
                  >
                    {s.id}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-right font-medium tabular-nums">
                  {formatINR(rupees(s.amount))}
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-[#8b96ad]">
                  {s.fees === null ? "—" : formatINR(rupees(s.fees))}
                </td>
                <td className="px-5 py-3 font-mono text-[0.8rem] text-[#5a6785]">{s.utr ?? "—"}</td>
                <td className="px-5 py-3">
                  <Chip tone={tone}>{label}</Chip>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[14px] border border-[#e3e7ee] bg-white p-[15px_18px] shadow-sm">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[#8b96ad]">
        {label}
      </p>
      <p className="mt-1 font-display text-[1.5rem] font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-[0.8rem] text-[#8b96ad]">{sub}</p>}
    </div>
  );
}
