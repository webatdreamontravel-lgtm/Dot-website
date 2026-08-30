import Link from "next/link";
import type { Metadata } from "next";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toRupees } from "@/lib/booking/pricing";
import { formatINR } from "@/lib/utils";
import { Chip, EmptyState, Panel } from "../ui";

export const metadata: Metadata = { title: "Travel credit" };

const KIND: Record<string, { label: string; tone: string }> = {
  ISSUED: { label: "Issued", tone: "info" },
  REDEEMED: { label: "Used", tone: "ok" },
  ADJUSTED: { label: "Adjusted", tone: "mute" },
};

/**
 * Every customer holding travel credit, and where it came from.
 *
 * ── Why the balances are grouped, not stored ──
 *
 * A customer's balance is SUM(amount_paise) over their entries, computed
 * here. Nothing caches it, so the number on this page and the rows beneath
 * it cannot disagree — which is the whole reason there is no balances table.
 *
 * The ledger is shown inline under each customer rather than behind a click.
 * The question this page answers is almost never "how much does X have" — it
 * is "where did that come from", asked while a customer is on the phone.
 */
export default async function CreditPage() {
  await requireAdmin();

  const balances = await prisma.creditEntry.groupBy({
    by: ["profileId"],
    _sum: { amountPaise: true },
    orderBy: { _sum: { amountPaise: "desc" } },
  });

  const holders = balances.filter((b) => (b._sum.amountPaise ?? 0) !== 0);
  const ids = holders.map((b) => b.profileId);

  const [profiles, entries] = await Promise.all([
    ids.length
      ? prisma.profile.findMany({
          where: { id: { in: ids } },
          select: { id: true, fullName: true, email: true, phone: true },
        })
      : [],
    ids.length
      ? prisma.creditEntry.findMany({
          where: { profileId: { in: ids } },
          orderBy: { createdAt: "desc" },
          select: {
            id: true, kind: true, amountPaise: true, note: true, createdAt: true,
            profileId: true,
            sourceBooking: { select: { reference: true, trip: { select: { title: true } } } },
            appliedBooking: { select: { reference: true, trip: { select: { title: true } } } },
          },
        })
      : [],
  ]);

  const byId = new Map(profiles.map((p) => [p.id, p]));
  const outstandingPaise = holders.reduce((n, b) => n + (b._sum.amountPaise ?? 0), 0);

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
        <Stat label="Customers holding credit" value={String(holders.length)} />
        {/* A liability, not income: this is money owed in travel that has
            already been paid for and not yet delivered. */}
        <Stat
          label="Outstanding"
          value={formatINR(toRupees(outstandingPaise))}
          sub="owed in future travel"
          tone={outstandingPaise > 0 ? "warn" : undefined}
        />
        <Stat label="Ledger entries" value={String(entries.length)} />
      </div>

      {holders.length === 0 ? (
        <Panel>
          <EmptyState
            title="Nobody is holding travel credit"
            body="Carrying a cancelled booking forward from its booking screen is what creates it."
          />
        </Panel>
      ) : (
        <div className="flex flex-col gap-4">
          {holders.map((b) => {
            const person = byId.get(b.profileId);
            const rows = entries.filter((e) => e.profileId === b.profileId);
            const balance = b._sum.amountPaise ?? 0;

            return (
              <Panel key={b.profileId}>
                <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[#eef1f6] px-5 py-3.5">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/customers/${b.profileId}`}
                      className="text-[0.95rem] font-semibold text-[#16203a] hover:text-teal"
                    >
                      {person?.fullName ?? person?.email ?? "Unknown customer"}
                    </Link>
                    <p className="text-[0.8rem] text-[#8b96ad]">
                      {[person?.phone, person?.email].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-[#8b96ad]">
                      Available
                    </div>
                    <div className="font-display text-[1.35rem] font-semibold tabular-nums text-[#0f8a5f]">
                      {formatINR(toRupees(balance))}
                    </div>
                  </div>
                </div>

                <ul className="divide-y divide-[#f2f4f7]">
                  {rows.map((e) => {
                    const kind = KIND[e.kind] ?? { label: e.kind, tone: "mute" };
                    const booking = e.sourceBooking ?? e.appliedBooking;
                    return (
                      <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
                        <span
                          className={`font-display text-[0.95rem] font-semibold tabular-nums ${
                            e.amountPaise > 0 ? "text-[#0f8a5f]" : "text-[#16203a]"
                          }`}
                        >
                          {e.amountPaise > 0 ? "+" : "−"}
                          {formatINR(toRupees(Math.abs(e.amountPaise)))}
                        </span>
                        <Chip tone={kind.tone}>{kind.label}</Chip>
                        {booking && (
                          <Link
                            href={`/admin/bookings/${booking.reference}`}
                            className="text-[0.83rem] text-[#5a6785] hover:text-teal"
                          >
                            {booking.reference}
                            <span className="text-[#8b96ad]"> · {booking.trip.title}</span>
                          </Link>
                        )}
                        {e.note && <span className="text-[0.8rem] text-[#8b96ad]">{e.note}</span>}
                        <span className="ml-auto whitespace-nowrap text-[0.8rem] text-[#8b96ad]">
                          {e.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </Panel>
            );
          })}
        </div>
      )}
    </>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "ok" | "warn" }) {
  const colour = tone === "ok" ? "text-[#0f8a5f]" : tone === "warn" ? "text-[#b26a00]" : "";
  return (
    <div className="rounded-[14px] border border-[#e3e7ee] bg-white p-[15px_18px] shadow-sm">
      <div className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-[#8b96ad]">{label}</div>
      <div className={`mt-1.5 font-display text-[1.5rem] font-semibold tabular-nums ${colour}`}>{value}</div>
      {sub && <div className="mt-1 text-[0.75rem] text-[#8b96ad]">{sub}</div>}
    </div>
  );
}
