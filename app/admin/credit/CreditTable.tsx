"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";

import { toRupees } from "@/lib/booking/pricing";
import { formatINR } from "@/lib/utils";
import { Chip } from "../ui";

const KIND: Record<string, { label: string; tone: string }> = {
  ISSUED: { label: "Issued", tone: "info" },
  REDEEMED: { label: "Used", tone: "ok" },
  ADJUSTED: { label: "Adjusted", tone: "mute" },
};

export type LedgerRow = {
  id: string;
  kind: string;
  amountPaise: number;
  note: string | null;
  /** Formatted on the server: the two runtimes are in different timezones
      and a date rendered twice must not come out differently. */
  date: string;
  reference: string | null;
  tripTitle: string | null;
};

export type HolderRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string;
  balancePaise: number;
  addedPaise: number;
  usedPaise: number;
  entries: number;
  lastAt: string;
  ledger: LedgerRow[];
};

/**
 * Customers holding travel credit, one row each, ledger behind a click.
 *
 * ── Why the ledger is expanded in place rather than on its own page ──
 *
 * It gets opened while a customer is on the phone, usually after searching
 * for their name. Navigating away and back would lose the search and the
 * page you were on every single time — so the rows open where they are, and
 * more than one can be open at once when two are being compared.
 *
 * Every ledger on the page is already in the HTML, so opening one is instant.
 */
export function CreditTable({ rows }: { rows: HolderRow[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <Th>Customer</Th>
            <Th className="hidden md:table-cell">Contact</Th>
            <Th className="hidden md:table-cell">Entries</Th>
            <Th className="hidden lg:table-cell">Last activity</Th>
            <Th className="text-right">Available</Th>
          </tr>
        </thead>

        {rows.map((r) => {
          const isOpen = open.has(r.id);
          const panelId = `ledger-${r.id}`;

          return (
            // One <tbody> per customer keeps the row and its ledger together,
            // so zebra striping and borders can't fall between them.
            <tbody key={r.id} className="border-b border-[#eef1f6] last:border-0">
              <tr
                onClick={(e) => {
                  // The row is a convenience for the mouse; the button below
                  // is what actually carries the semantics. Ignore clicks
                  // that landed on something already interactive.
                  if (!(e.target as HTMLElement).closest("a,button")) toggle(r.id);
                }}
                className={
                  "cursor-pointer transition-colors " +
                  (isOpen ? "bg-[#f7fafc]" : "hover:bg-[#fafbfd]")
                }
              >
                <td className="py-3 pl-3 pr-2 sm:px-4">
                  <button
                    type="button"
                    onClick={() => toggle(r.id)}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    className="-my-1.5 flex min-h-[44px] w-full items-center gap-2 py-1.5 text-left"
                  >
                    <ChevronRight
                      aria-hidden
                      className={
                        "h-4 w-4 flex-none text-[#8b96ad] transition-transform " +
                        (isOpen ? "rotate-90" : "")
                      }
                    />
                    <span className="min-w-0">
                      <span className="block text-[0.89rem] font-semibold text-navy">
                        {r.name}
                      </span>
                      {/* Below md the contact column is gone, so the same
                          details ride under the name instead. Capped in vw
                          because a table cell will otherwise widen to fit a
                          long email and push the balance off the screen. */}
                      <span className="block max-w-[44vw] truncate text-[0.78rem] text-[#8b96ad] md:hidden">
                        {r.phone ? `${r.phone} · ` : ""}
                        {r.entries} {r.entries === 1 ? "entry" : "entries"}
                      </span>
                      <span className="block max-w-[44vw] truncate text-[0.78rem] text-[#8b96ad] md:hidden">
                        {r.email}
                      </span>
                    </span>
                  </button>
                </td>

                <td className="hidden px-4 py-3 md:table-cell">
                  <div className="text-[0.83rem] text-navy">{r.phone ?? "—"}</div>
                  <div className="text-[0.78rem] text-[#8b96ad]">{r.email}</div>
                </td>

                <td className="hidden px-4 py-3 text-[0.85rem] tabular-nums text-[#5a6785] md:table-cell">
                  {r.entries}
                </td>

                <td className="hidden whitespace-nowrap px-4 py-3 text-[0.8rem] text-[#8b96ad] lg:table-cell">
                  {r.lastAt}
                </td>

                <td className="whitespace-nowrap py-3 pl-2 pr-3 text-right align-middle sm:px-4">
                  <span
                    className={
                      "font-display text-[1rem] font-semibold tabular-nums " +
                      (r.balancePaise > 0 ? "text-[#0f8a5f]" : "text-[#8b96ad]")
                    }
                  >
                    {formatINR(toRupees(r.balancePaise))}
                  </span>
                </td>
              </tr>

              {isOpen && (
                <tr id={panelId}>
                  <td colSpan={5} className="bg-[#f7fafc] px-3 pb-4 pt-1 sm:px-5">
                    <Ledger row={r} />
                  </td>
                </tr>
              )}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}

function Ledger({ row }: { row: HolderRow }) {
  return (
    <div className="overflow-hidden rounded-[12px] border border-[#e3e7ee] bg-white">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-[#eef1f6] px-4 py-2.5">
        <Figure label="Given" value={row.addedPaise} tone="text-[#0f8a5f]" />
        <Figure label="Spent" value={row.usedPaise} tone="text-[#16203a]" />
        <Figure label="Left" value={row.balancePaise} tone="text-[#0f8a5f]" />
        <Link
          href={`/admin/customers/${row.id}`}
          className="ml-auto inline-flex items-center gap-1.5 text-[0.82rem] font-medium text-[#5a6785] underline-offset-2 hover:text-teal hover:underline"
        >
          Customer profile <ExternalLink aria-hidden className="h-3.5 w-3.5" />
        </Link>
      </div>

      <ul className="divide-y divide-[#f2f4f7]">
        {row.ledger.map((e) => {
          const kind = KIND[e.kind] ?? { label: e.kind, tone: "mute" };
          return (
            <li
              key={e.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5"
            >
              <span
                className={
                  "font-display text-[0.92rem] font-semibold tabular-nums " +
                  (e.amountPaise > 0 ? "text-[#0f8a5f]" : "text-[#16203a]")
                }
              >
                {e.amountPaise > 0 ? "+" : "−"}
                {formatINR(toRupees(Math.abs(e.amountPaise)))}
              </span>
              <Chip tone={kind.tone}>{kind.label}</Chip>

              {e.reference && (
                <Link
                  href={`/admin/bookings/${e.reference}`}
                  className="order-last text-[0.83rem] text-[#5a6785] hover:text-teal sm:order-none"
                >
                  {e.reference}
                  {e.tripTitle && <span className="text-[#8b96ad]"> · {e.tripTitle}</span>}
                </Link>
              )}

              {e.note && (
                <span className="order-last text-[0.8rem] text-[#8b96ad] sm:order-none">
                  {e.note}
                </span>
              )}

              <span className="ml-auto whitespace-nowrap text-[0.8rem] text-[#8b96ad]">
                {e.date}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Figure({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <span className="text-[0.8rem] text-[#8b96ad]">
      {label}{" "}
      <b className={`font-display font-semibold tabular-nums ${tone}`}>
        {formatINR(toRupees(value))}
      </b>
    </span>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`whitespace-nowrap border-b border-[#e3e7ee] bg-[#fbfcfe] px-4 py-2.5 text-left text-[0.72rem] font-semibold uppercase tracking-[0.09em] text-[#8b96ad] ${className}`}
    >
      {children}
    </th>
  );
}
