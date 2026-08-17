import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Tab strip for admin detail screens.
 *
 * Real links carrying the tab in the URL, not client state: a filtered
 * bookings view stays shareable and survives a refresh, and the browser back
 * button moves between tabs the way people expect.
 */
export function Tabs({
  tabs,
  active,
  basePath,
}: {
  tabs: { key: string; label: string; count?: number }[];
  active: string;
  basePath: string;
}) {
  return (
    <div
      role="tablist"
      className="mb-5 flex gap-1 border-b border-[#e3e7ee]"
    >
      {tabs.map((t) => {
        const selected = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.key === tabs[0].key ? basePath : `${basePath}?tab=${t.key}`}
            role="tab"
            aria-selected={selected}
            className={cn(
              "-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-[0.88rem] font-medium transition",
              selected
                ? "border-teal text-navy"
                : "border-transparent text-[#8b96ad] hover:border-[#c3cad8] hover:text-navy",
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[0.72rem] font-semibold tabular-nums",
                  selected ? "bg-teal/12 text-teal" : "bg-[#eef1f6] text-[#8b96ad]",
                )}
              >
                {t.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
