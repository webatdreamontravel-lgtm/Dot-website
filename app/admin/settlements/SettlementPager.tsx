"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

/**
 * Prev/next pager for settlements.
 *
 * Not the shared <Pagination>, and not for want of trying: that component
 * renders "page 3 of 9" and "showing 41–60 of 173", and none of those numbers
 * exist here. A Razorpay collection reports how many items came back, never
 * how many there are — so page counts and totals are simply not derivable.
 *
 * `hasMore` comes from asking for one row more than we display and seeing
 * whether it arrives. That is enough to know if Next should be live, which is
 * all this needs to be honest about.
 */
export function SettlementPager({
  page,
  hasMore,
  shown,
}: {
  page: number;
  hasMore: boolean;
  shown: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const go = (to: number) => {
    const next = new URLSearchParams(params.toString());
    // Page 1 is the default; leaving ?page=1 in the URL is just noise.
    if (to <= 1) next.delete("page");
    else next.set("page", String(to));
    const qs = next.toString();
    startTransition(() => router.push(qs ? `/admin/settlements?${qs}` : "/admin/settlements"));
  };

  if (page === 1 && !hasMore) {
    return (
      <div className="border-t border-[#e3e7ee] bg-[#fcfdfe] px-5 py-3 text-[0.8rem] text-[#8b96ad]">
        {shown} settlement{shown === 1 ? "" : "s"}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 border-t border-[#e3e7ee] bg-[#fcfdfe] px-5 py-3 text-[0.8rem] text-[#8b96ad]">
      <span className="inline-flex items-center gap-2">
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {/* No "of N" — see the note above. */}
        Page {page} · {shown} shown
      </span>

      <span className="flex gap-1.5">
        <button
          type="button"
          onClick={() => go(page - 1)}
          disabled={page <= 1 || pending}
          className="inline-flex items-center gap-1 rounded-lg border border-[#e3e7ee] bg-white px-2.5 py-1.5 font-medium text-[#5a6785] hover:text-navy disabled:opacity-40"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Previous
        </button>
        <button
          type="button"
          onClick={() => go(page + 1)}
          disabled={!hasMore || pending}
          className="inline-flex items-center gap-1 rounded-lg border border-[#e3e7ee] bg-white px-2.5 py-1.5 font-medium text-[#5a6785] hover:text-navy disabled:opacity-40"
        >
          Next <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </span>
    </div>
  );
}
