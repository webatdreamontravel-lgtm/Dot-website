"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Pages through the bookings list.
 *
 * Links rather than buttons, so a page can be opened in a new tab, shared,
 * and reached with the back button — the URL is the state. Hidden entirely
 * when everything fits on one page: pagination for a single page is furniture.
 */
export function AccountPagination({
  page,
  pageCount,
  total,
}: {
  page: number;
  pageCount: number;
  total: number;
}) {
  const params = useSearchParams();
  if (pageCount <= 1) return null;

  const href = (p: number) => {
    const next = new URLSearchParams(params);
    if (p > 1) next.set("page", String(p));
    else next.delete("page");
    const qs = next.toString();
    return qs ? `/account?${qs}` : "/account";
  };

  const step =
    "inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-navy/15 px-4 text-[0.88rem] font-medium text-navy transition hover:bg-navy/[0.04]";
  const disabled = "pointer-events-none opacity-40";

  return (
    <nav
      aria-label="Bookings pages"
      className="mt-6 flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-[0.85rem] text-navy/50" aria-live="polite">
        Page {page} of {pageCount} · {total} {total === 1 ? "booking" : "bookings"}
      </p>

      <div className="flex items-center gap-2">
        <Link
          href={href(page - 1)}
          aria-disabled={page === 1}
          tabIndex={page === 1 ? -1 : undefined}
          className={cn(step, page === 1 && disabled)}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Newer
        </Link>
        <Link
          href={href(page + 1)}
          aria-disabled={page === pageCount}
          tabIndex={page === pageCount ? -1 : undefined}
          className={cn(step, page === pageCount && disabled)}
        >
          Older
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </nav>
  );
}
