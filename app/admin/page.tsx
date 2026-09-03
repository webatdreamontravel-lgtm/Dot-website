import Link from "next/link";
import { AlertTriangle, ArrowRight, Clock, IndianRupee, Users } from "lucide-react";

import { requireAdmin } from "@/lib/auth";
import { countDepartedTrips, getDashboardStats, getUpcomingTrips, rupees } from "@/lib/queries/admin";
import { formatINR } from "@/lib/utils";
import { Panel } from "./ui";

export default async function AdminDashboard() {
  const admin = await requireAdmin();
  // Queried directly rather than pulling every trip and filtering in memory —
  // the dashboard only ever shows the next handful.
  const [stats, live, departed] = await Promise.all([
    getDashboardStats(),
    getUpcomingTrips(),
    countDepartedTrips(),
  ]);

  const needsAttention = stats.failedPayments + stats.pendingRequests + departed;

  return (
    <>
      <header className="mb-6 flex flex-wrap items-center gap-4">
        <div>
          <h1 className="font-display text-[1.85rem] font-semibold tracking-tight">
            {greeting()}, {(admin.fullName ?? admin.email).split(" ")[0]}
          </h1>
          <p className="mt-0.5 text-[0.85rem] text-[#8b96ad]">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            {needsAttention > 0 && ` · ${needsAttention} thing${needsAttention === 1 ? "" : "s"} need attention`}
          </p>
        </div>
        <Link href="/admin/trips/new" className="ml-auto rounded-lg bg-navy px-3.5 py-2 text-[0.85rem] font-medium text-cream hover:bg-[#1b2f56]">
          + New trip
        </Link>
      </header>

      <div className="mb-5 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Collected"
          value={formatINR(rupees(stats.collectedPaise))}
          sub="all captured payments"
          icon={IndianRupee}
        />
        <Kpi
          label="Outstanding"
          value={formatINR(rupees(stats.outstandingPaise))}
          sub="still to be collected"
          tone={stats.outstandingPaise > 0 ? "warn" : undefined}
          icon={Clock}
        />
        <Kpi
          label="Seats sold"
          value={`${stats.seatsSold}`}
          sub={`of ${stats.seatsTotal} across ${stats.liveTrips} live trip${stats.liveTrips === 1 ? "" : "s"}`}
          icon={Users}
        />
        <Kpi
          label="Needs follow-up"
          value={`${stats.failedPayments + stats.pendingRequests}`}
          sub={`${stats.failedPayments} failed · ${stats.pendingRequests} requests`}
          tone={stats.failedPayments + stats.pendingRequests > 0 ? "bad" : undefined}
          icon={AlertTriangle}
        />
      </div>

      <Panel
        title="Seats filling up"
        action={<Link href="/admin/trips" className="inline-flex items-center gap-1 text-[0.82rem] text-[#5a6785] hover:text-navy">Manage trips <ArrowRight className="h-3.5 w-3.5" /></Link>}
      >
        {live.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-[0.92rem] font-medium">No live trips right now</p>
            <p className="mt-1 text-[0.83rem] text-[#8b96ad]">
              Publish a trip and it appears on the site immediately.
            </p>
            <Link href="/admin/trips/new" className="mt-4 inline-block rounded-lg bg-navy px-3.5 py-2 text-[0.85rem] font-medium text-cream">
              Create a trip
            </Link>
          </div>
        ) : (
          <div className="px-5">
            {live.map((t) => {
              const pctFull = Math.round((t.seatsBooked / t.totalSeats) * 100);
              const tone = pctFull >= 90 ? "bg-[#c33a3a]" : pctFull >= 65 ? "bg-[#b26a00]" : "bg-teal";
              return (
                <Link
                  key={t.id}
                  // Straight to this trip's bookings, not its edit form. The
                  // question this list raises is "who is on it / who still
                  // owes" — the seat count is what prompted the click.
                  href={`/admin/trips/${t.id}/bookings`}
                  className="flex items-center gap-3.5 border-b border-[#eef1f6] py-3 last:border-0 hover:bg-[#fafbfd]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[0.89rem] font-semibold">{t.title}</div>
                    <div className="text-[0.78rem] text-[#8b96ad]">
                      {t.startDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} ·{" "}
                      {daysUntil(t.startDate)} days out
                    </div>
                    <div className="mt-1.5 h-[7px] w-full overflow-hidden rounded-full bg-[#e3e7ee]">
                      <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(pctFull, 100)}%` }} />
                    </div>
                  </div>
                  <div className="w-14 flex-none text-right text-[0.83rem] font-semibold tabular-nums">
                    {t.seatsBooked}/{t.totalSeats}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Panel>
    </>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function daysUntil(d: Date) {
  return Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86_400_000));
}

function Kpi({
  label, value, sub, tone, icon: Icon,
}: {
  label: string; value: string; sub: string;
  tone?: "warn" | "bad";
  icon: React.ComponentType<{ className?: string }>;
}) {
  const valueTone = tone === "bad" ? "text-[#c33a3a]" : tone === "warn" ? "text-[#b26a00]" : "";
  return (
    <div className={`relative overflow-hidden rounded-[14px] border bg-white p-[17px_19px] shadow-sm ${tone ? "border-[#f0cfcf]" : "border-[#e3e7ee]"}`}>
      <div className="flex items-center gap-2 text-[0.74rem] font-semibold uppercase tracking-[0.1em] text-[#8b96ad]">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className={`mt-2 font-display text-[1.95rem] font-semibold tracking-tight tabular-nums ${valueTone}`}>
        {value}
      </div>
      <div className="text-[0.79rem] text-[#5a6785]">{sub}</div>
    </div>
  );
}
