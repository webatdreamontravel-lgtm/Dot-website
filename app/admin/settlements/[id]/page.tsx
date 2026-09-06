import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AlertTriangle, ArrowLeft } from "lucide-react";

import { requireAdmin } from "@/lib/auth";
import { isTestMode, paymentsConfigured } from "@/lib/payments/client";
import { rupees } from "@/lib/queries/admin";
import {
  attachBookings,
  getSettlement,
  getSettlementRecon,
  settlementTone,
  type ReconRowWithBooking,
  type Settlement,
} from "@/lib/queries/settlements";
import { formatINR } from "@/lib/utils";
import { Chip, EmptyState, Panel } from "../../ui";
import { BreakdownBars } from "./loading";

export const metadata = { title: "Settlement" };

/**
 * One settlement, resolved into the bookings it paid for.
 *
 * The reason this screen exists rather than a link to the Razorpay dashboard:
 * Razorpay can say a settlement contained fourteen payments. Only we can say
 * that those were the Munnar batch, and who was on it.
 *
 * The recon report is keyed by month, not by settlement, so getSettlementRecon
 * walks the settlement's month and keeps what matches. That is a handful of
 * API calls, which is why this lives on its own page rather than expanding
 * inline in the list.
 */
export default async function SettlementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  if (!paymentsConfigured()) {
    return (
      <Shell id={id}>
        <Panel title="Razorpay isn't configured">
          <div className="px-5 py-6 text-[0.88rem] text-[#5a6785]">
            Set the Razorpay keys and restart.
          </div>
        </Panel>
      </Shell>
    );
  }

  const settlement = await getSettlement(id);
  if (!settlement) notFound();

  const { tone, label } = settlementTone(settlement.status);

  return (
    <Shell id={settlement.id}>
      {isTestMode() && (
        <p
          role="alert"
          className="mb-5 flex items-start gap-2 rounded-xl border border-[#f0dcae] bg-[#fdf6e3] px-4 py-3 text-[0.85rem] text-[#7a4a00]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
          Test mode — sandbox data, no money has moved.
        </p>
      )}

      <div className="mb-5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Amount settled" value={formatINR(rupees(settlement.amount))} />
        <Stat
          label="Fees"
          value={settlement.fees === null ? "—" : formatINR(rupees(settlement.fees))}
          sub={settlement.tax === null ? undefined : `incl. ${formatINR(rupees(settlement.tax))} tax`}
        />
        <Stat
          label="Settled on"
          value={settlement.createdAt.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        />
        <div className="rounded-[14px] border border-[#e3e7ee] bg-white p-[15px_18px] shadow-sm">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[#8b96ad]">
            Status
          </p>
          <p className="mt-2">
            <Chip tone={tone}>{label}</Chip>
          </p>
          {settlement.utr && (
            <p className="mt-2 font-mono text-[0.78rem] text-[#5a6785]">UTR {settlement.utr}</p>
          )}
        </div>
      </div>

      {/* The recon walk is the slow half — it pages through the settlement's
          whole month at the API, which can be several round trips. Behind its
          own boundary so the settlement's own figures paint immediately
          instead of the entire page waiting on it. */}
      <Panel title="What this settlement paid for">
        <Suspense fallback={<BreakdownBars />}>
          <BreakdownSection settlement={settlement} />
        </Suspense>
      </Panel>
    </Shell>
  );
}

/**
 * The transactions inside the settlement, resolved to bookings.
 *
 * Its own async component so Suspense has something to wait on. Errors are
 * caught here rather than allowed to bubble: the settlement's figures are
 * already on screen and correct, and a recon failure should cost the
 * breakdown, not the page.
 */
async function BreakdownSection({ settlement }: { settlement: Settlement }) {
  let rows: ReconRowWithBooking[] = [];
  try {
    rows = await attachBookings(await getSettlementRecon(settlement));
  } catch (e) {
    return (
      <div className="px-5 py-8 text-center text-[0.88rem] text-[#c33a3a]">
        Couldn&rsquo;t load the breakdown: {e instanceof Error ? e.message : String(e)}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No transactions found"
        body="Razorpay's recon report has nothing filed against this settlement yet. It can lag the settlement itself by a day."
      />
    );
  }

  const matched = rows.filter((r) => r.booking).length;

  return (
    <>
      {matched < rows.length && (
        <p className="border-b border-[#f0dcae] bg-[#fdf6e3] px-5 py-2.5 text-[0.83rem] text-[#7a4a00]">
          {rows.length - matched} of {rows.length} transactions couldn&rsquo;t be matched to a
          booking — they may be refunds, adjustments, or payments taken outside this site.
        </p>
      )}
      <Breakdown rows={rows} />
    </>
  );
}

function Shell({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <>
      <header className="mb-6">
        <Link
          href="/admin/settlements"
          className="mb-2 inline-flex items-center gap-1.5 text-[0.83rem] font-medium text-[#8b96ad] hover:text-navy"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All settlements
        </Link>
        <h1 className="font-display text-[1.6rem] font-semibold leading-tight tracking-tight">
          <span className="font-mono text-[1.2rem] text-[#5a6785]">{id}</span>
        </h1>
      </header>
      {children}
    </>
  );
}

function Breakdown({ rows }: { rows: ReconRowWithBooking[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] border-collapse text-[0.87rem]">
        <thead>
          <tr className="border-b border-[#e3e7ee] text-left text-[0.74rem] uppercase tracking-[0.08em] text-[#8b96ad]">
            <th className="px-5 py-2.5 font-semibold">Type</th>
            <th className="px-5 py-2.5 font-semibold">Booking</th>
            <th className="px-5 py-2.5 font-semibold">Razorpay ID</th>
            <th className="px-5 py-2.5 font-semibold">Method</th>
            <th className="px-5 py-2.5 text-right font-semibold">Amount</th>
            <th className="px-5 py-2.5 text-right font-semibold">Fee</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={`${r.entityId}-${i}`}
              className="border-b border-[#eef1f6] last:border-0 hover:bg-[#fbfcfe]"
            >
              <td className="whitespace-nowrap px-5 py-3 capitalize text-[#5a6785]">{r.type}</td>
              <td className="px-5 py-3">
                {r.booking ? (
                  <>
                    <Link
                      href={`/admin/bookings/${r.booking.reference}`}
                      className="font-medium text-navy underline underline-offset-4 hover:text-teal"
                    >
                      {r.booking.reference}
                    </Link>
                    <span className="block text-[0.79rem] text-[#8b96ad]">
                      {r.booking.tripTitle}
                      {r.booking.customerName ? ` · ${r.booking.customerName}` : ""}
                    </span>
                  </>
                ) : (
                  <span className="text-[#8b96ad]">Not ours</span>
                )}
              </td>
              <td className="px-5 py-3 font-mono text-[0.78rem] text-[#5a6785]">
                {r.paymentId ?? r.orderId ?? r.entityId}
              </td>
              <td className="whitespace-nowrap px-5 py-3 uppercase text-[#8b96ad]">
                {r.method ?? "—"}
              </td>
              <td className="whitespace-nowrap px-5 py-3 text-right font-medium tabular-nums">
                {formatINR(rupees(r.amount))}
              </td>
              <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-[#8b96ad]">
                {formatINR(rupees(r.fee))}
              </td>
            </tr>
          ))}
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
      <p className="mt-1 font-display text-[1.35rem] font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-[0.8rem] text-[#8b96ad]">{sub}</p>}
    </div>
  );
}
