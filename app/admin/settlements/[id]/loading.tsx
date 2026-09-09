import { Bar } from "../../TableSkeleton";
import { Panel } from "../../ui";

/**
 * Matches the real screen's shape — heading, four stat cards, then the
 * breakdown table — so nothing moves when the data lands.
 *
 * The stat cards are shown as placeholders even though the settlement itself
 * loads quickly, because this file covers the whole route's first paint. Once
 * the page is rendering, the slow half (the recon walk) has its own Suspense
 * boundary inside the page.
 */
export default function Loading() {
  return (
    <>
      <header className="mb-6">
        <Bar className="h-3 w-28" />
        <Bar className="mt-2.5 h-6 w-56" />
      </header>

      <div className="mb-5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-[14px] border border-[#e3e7ee] bg-white p-[15px_18px] shadow-sm">
            <Bar className="h-2.5 w-20" />
            <Bar className="mt-2.5 h-5 w-24" />
            <Bar className="mt-2 h-2.5 w-16" />
          </div>
        ))}
      </div>

      <Panel>
        <BreakdownBars />
      </Panel>
    </>
  );
}

/** Also used by the in-page Suspense fallback, so both waits look the same. */
export function BreakdownBars({ rows = 6 }: { rows?: number }) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          {Array.from({ length: 6 }, (_, i) => (
            <th key={i} className="border-b border-[#e3e7ee] bg-[#fbfcfe] px-4 py-2.5 text-left">
              <Bar className="h-2.5 w-16" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }, (_, r) => (
          <tr key={r}>
            {Array.from({ length: 6 }, (_, c) => (
              <td key={c} className="border-b border-[#eef1f6] px-4 py-3">
                <Bar className={c === 1 ? "h-3.5 w-36" : "h-3.5 w-14"} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
