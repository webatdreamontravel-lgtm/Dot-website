import { Panel } from "./ui";

/**
 * Placeholder shown while an admin list screen loads.
 *
 * Deliberately the same shape as the real table — same header row, same
 * column count, same row height — so the page doesn't jump when the data
 * arrives. A centred spinner would avoid the work and cause the jump.
 */
export function TableSkeleton({
  columns,
  rows = 8,
  title = false,
}: {
  columns: number;
  rows?: number;
  /** Also draw a placeholder page heading above the panel. */
  title?: boolean;
}) {
  return (
    <>
      {title && (
        <header className="mb-6">
          <Bar className="h-7 w-40" />
          <Bar className="mt-2 h-3.5 w-56" />
        </header>
      )}

      <Panel>
        <div className="flex flex-wrap items-end gap-2.5 border-b border-[#e3e7ee] bg-[#fcfdfe] px-5 py-3.5">
          <Bar className="h-[38px] min-w-[240px] flex-1" />
          <Bar className="h-[38px] w-32" />
          <Bar className="h-[38px] w-32" />
          <Bar className="h-[38px] w-20" />
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr>
              {Array.from({ length: columns }, (_, i) => (
                <th key={i} className="border-b border-[#e3e7ee] bg-[#fbfcfe] px-4 py-2.5 text-left">
                  <Bar className="h-2.5 w-16" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, r) => (
              <tr key={r}>
                {Array.from({ length: columns }, (_, c) => (
                  <td key={c} className="border-b border-[#eef1f6] px-4 py-3">
                    {/* First column is the wide identity column in every one
                        of these tables, so it gets a wider bar. */}
                    <Bar className={c === 0 ? "h-3.5 w-36" : "h-3.5 w-14"} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}

/** Exported so screens with a non-table shape can build a matching skeleton. */
export function Bar({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse rounded bg-[#eef1f6] ${className ?? ""}`}
    />
  );
}
