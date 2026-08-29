"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Loader2, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";

const VIEWS = [
  { value: "", label: "All" },
  { value: "upcoming", label: "Upcoming" },
  { value: "owing", label: "To pay" },
  { value: "past", label: "Past" },
] as const;

/**
 * Search and view filter for the customer's bookings.
 *
 * State lives in the URL, so a filtered view survives a refresh, works with
 * the back button, and can be linked to. Submitting goes through the router
 * inside a transition rather than a full page load, so the list can dim
 * while the new rows arrive instead of the screen going blank.
 *
 * The views are segmented buttons rather than a <select>: there are four of
 * them, they are the primary way to navigate this page, and on a phone a
 * row of thumb-sized targets beats a native picker.
 */
export function AccountToolbar({
  total,
  showing,
  children,
}: {
  total: number;
  showing: number;
  /** The list, passed in so it stays a server component. */
  children: React.ReactNode;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const q = params.get("q") ?? "";
  const view = params.get("view") ?? "";

  const go = (next: URLSearchParams) => {
    // Changing a filter changes how many results there are, so page 3 of the
    // old set is meaningless.
    next.delete("page");
    const qs = next.toString();
    startTransition(() => router.push(qs ? `/account?${qs}` : "/account"));
  };

  const setView = (v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set("view", v);
    else next.delete("view");
    go(next);
  };

  const submitSearch = (form: HTMLFormElement) => {
    const next = new URLSearchParams(params);
    const value = String(new FormData(form).get("q") ?? "").trim();
    if (value) next.set("q", value);
    else next.delete("q");
    go(next);
  };

  return (
    <>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <form
          // Keyed on the query string so Clear and the back button actually
          // empty the input rather than leaving stale text behind.
          key={params.toString()}
          onSubmit={(e) => {
            e.preventDefault();
            submitSearch(e.currentTarget);
          }}
          className="relative flex-1"
        >
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/35"
            aria-hidden
          />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search by trip or booking reference…"
            aria-label="Search your bookings"
            className="w-full rounded-full border border-navy/12 bg-cream py-3 pl-11 pr-10 text-[0.92rem] text-navy outline-none transition placeholder:text-navy/35 focus:border-teal"
          />
          {q && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                const next = new URLSearchParams(params);
                next.delete("q");
                go(next);
              }}
              className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-navy/40 transition hover:bg-navy/5 hover:text-navy"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </form>

        {/* Wraps rather than scrolling. A clipped or horizontally-scrolling
            chip row hides options — at a larger text size, or on a narrow
            phone, "Past" simply disappears off the edge with nothing to
            suggest it is there. */}
        <div
          role="group"
          aria-label="Filter bookings"
          className="flex flex-wrap gap-1 rounded-2xl border border-navy/12 bg-cream p-1 sm:rounded-full"
        >
          {VIEWS.map((v) => (
            <button
              key={v.value}
              type="button"
              onClick={() => setView(v.value)}
              aria-pressed={view === v.value}
              className={cn(
                "min-h-[40px] whitespace-nowrap rounded-full px-4 py-2 text-[0.85rem] font-medium transition",
                view === v.value
                  ? "bg-navy text-cream"
                  : "text-navy/60 hover:bg-navy/5 hover:text-navy",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {(q || view) && (
        <p className="mt-3 text-[0.85rem] text-navy/50">
          {showing} of {total} {total === 1 ? "booking" : "bookings"}
          {q && <> matching &ldquo;{q}&rdquo;</>}
        </p>
      )}

      {/* aria-busy so a screen reader announces the wait; the dimming is
          only visible to people who can see it. */}
      <div
        aria-busy={pending}
        className={cn("relative transition-opacity", pending && "pointer-events-none opacity-45")}
      >
        {pending && (
          <div className="absolute inset-x-0 top-8 z-10 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-navy/10 bg-cream px-4 py-2 text-[0.85rem] text-navy/60 shadow-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </span>
          </div>
        )}
        {children}
      </div>
    </>
  );
}
