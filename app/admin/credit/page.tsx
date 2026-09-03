import type { Metadata } from "next";

import { requireAdmin } from "@/lib/auth";
import { creditHistories } from "@/lib/credit/ledger";
import { getCreditHolders, getCreditTotals, rupees } from "@/lib/queries/admin";
import { formatINR } from "@/lib/utils";
import { EmptyState, Panel } from "../ui";
import { FilterBar, FilterField, FilterSelect } from "../FilterBar";
import { Pagination } from "../Pagination";
import { CreditTable, type HolderRow } from "./CreditTable";

export const metadata: Metadata = { title: "Travel credit" };

type SP = Promise<{ q?: string; balance?: string; page?: string }>;

const day = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/**
 * Every customer holding travel credit, and where it came from.
 *
 * ── Why the balances are grouped, not stored ──
 *
 * A customer's balance is SUM(amount_paise) over their entries, computed on
 * read. Nothing caches it, so the number in the table and the rows behind it
 * cannot disagree — which is the whole reason there is no balances table.
 */
/** What to say when the table is empty — which depends on why it is. */
function emptyBody({ q, balance }: { q?: string; balance?: string }) {
  if (balance === "spent") {
    return q
      ? "Nobody matching that has spent all of their credit."
      : "Everyone who has been given travel credit still has some left.";
  }
  if (balance === "all") return "No customer with a credit entry matches that search.";
  if (q) {
    return (
      "Nobody holding credit matches that. Customers who have already spent theirs " +
      "are hidden — switch Balance to “Everyone” to include them."
    );
  }
  return "Carrying a cancelled booking forward from its booking screen is what creates it.";
}

export default async function CreditPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const filters = await searchParams;

  // Totals are read separately from the table on purpose: they describe the
  // business, not the search. See getCreditTotals().
  const [totals, { rows, total, page, perPage, pageCount }] = await Promise.all([
    getCreditTotals(),
    getCreditHolders(filters),
  ]);

  const ledgers = await creditHistories(rows.map((r) => r.id));

  const holders: HolderRow[] = rows.map((r) => ({
    id: r.id,
    name: r.fullName ?? r.email,
    phone: r.phone,
    email: r.email,
    balancePaise: r.balancePaise,
    addedPaise: r.addedPaise,
    usedPaise: r.usedPaise,
    entries: r.entries,
    lastAt: day(r.lastAt),
    ledger: (ledgers.get(r.id) ?? []).map((e) => {
      const booking = e.sourceBooking ?? e.appliedBooking;
      return {
        id: e.id,
        kind: e.kind,
        amountPaise: e.amountPaise,
        note: e.note,
        date: day(e.createdAt),
        reference: booking?.reference ?? null,
        tripTitle: booking?.trip.title ?? null,
      };
    }),
  }));

  const hasFilters = Boolean(filters.q || filters.balance);

  return (
    <>
      <header className="mb-6">
        <h1 className="font-display text-[1.85rem] font-semibold leading-tight tracking-tight">
          Travel credit
        </h1>
        <p className="mt-0.5 text-[0.85rem] text-[#8b96ad]">
          Money kept from cancelled bookings, waiting to be spent on a future trip.
        </p>
      </header>

      <div className="mb-5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Customers holding credit" value={String(totals.holders)} />
        {/* A liability, not income: this is money owed in travel that has
            already been paid for and not yet delivered. */}
        <Stat
          label="Outstanding"
          value={formatINR(rupees(totals.outstanding))}
          sub="owed in future travel"
          tone={totals.outstanding > 0 ? "warn" : undefined}
        />
        <Stat label="Ledger entries" value={String(totals.entries)} />
      </div>

      <Panel>
        <FilterBar
          action="/admin/credit"
          hasFilters={hasFilters}
          searchPlaceholder="Name, phone or email…"
          table={
            holders.length === 0 ? (
              <EmptyState
                title={hasFilters ? "Nobody matches that" : "Nobody is holding travel credit"}
                body={emptyBody(filters)}
              />
            ) : (
              <>
                <CreditTable rows={holders} />
                <Pagination
                  action="/admin/credit"
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
          <FilterField label="Balance">
            <FilterSelect
              name="balance"
              value={filters.balance}
              // The empty option is the default view, not "no filter".
              placeholder="Holding credit"
              options={[
                { value: "spent", label: "Fully used" },
                { value: "all", label: "Everyone" },
              ]}
            />
          </FilterField>
        </FilterBar>
      </Panel>
    </>
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
      {sub && <div className="mt-1 text-[0.75rem] text-[#8b96ad]">{sub}</div>}
    </div>
  );
}
