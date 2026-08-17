"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

/**
 * Pager for the admin tables.
 *
 * Every existing filter is carried across — only `page` changes — so paging
 * through a filtered view doesn't silently drop the filter. Renders nothing
 * when everything already fits on one page.
 */
export function Pagination({
  action,
  page,
  pageCount,
  total,
  perPage,
  noun,
}: {
  action: string;
  page: number;
  pageCount: number;
  total: number;
  perPage: number;
  /** Plural noun for the summary line, e.g. "trips". */
  noun: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  if (pageCount <= 1) {
    return (
      <div className="border-t border-[#e3e7ee] bg-[#fcfdfe] px-5 py-3 text-[0.8rem] text-[#8b96ad]">
        {total} {total === 1 ? noun.replace(/s$/, "") : noun}
      </div>
    );
  }

  const first = (page - 1) * perPage + 1;
  const last = Math.min(page * perPage, total);

  const go = (to: number) => {
    const next = new URLSearchParams(params.toString());
    // Page 1 is the default, so it doesn't need to clutter the URL.
    if (to <= 1) next.delete("page");
    else next.set("page", String(to));
    const qs = next.toString();
    startTransition(() => router.push(qs ? `${action}?${qs}` : action));
  };

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-[#e3e7ee] bg-[#fcfdfe] px-5 py-3">
      <p className="text-[0.8rem] text-[#5a6785]">
        Showing <b className="tabular-nums text-navy">{first}–{last}</b> of{" "}
        <b className="tabular-nums text-navy">{total}</b> {noun}
      </p>

      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#8b96ad]" />}

      <div className="ml-auto flex items-center gap-1.5">
        <PageButton onClick={() => go(page - 1)} disabled={page <= 1 || pending} label="Previous page">
          <ChevronLeft className="h-3.5 w-3.5" /> Prev
        </PageButton>

        <span className="px-2 text-[0.8rem] tabular-nums text-[#5a6785]">
          Page {page} of {pageCount}
        </span>

        <PageButton onClick={() => go(page + 1)} disabled={page >= pageCount || pending} label="Next page">
          Next <ChevronRight className="h-3.5 w-3.5" />
        </PageButton>
      </div>
    </div>
  );
}

function PageButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="inline-flex items-center gap-1 rounded-lg border border-[#e3e7ee] bg-white px-2.5 py-1.5 text-[0.82rem] font-medium text-[#5a6785] transition hover:border-teal hover:text-navy disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[#e3e7ee] disabled:hover:text-[#5a6785]"
    >
      {children}
    </button>
  );
}
