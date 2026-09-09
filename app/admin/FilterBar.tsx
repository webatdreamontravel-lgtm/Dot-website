"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { AlertTriangle, Loader2, Search } from "lucide-react";

import { isReversedRange } from "@/lib/dates";

/**
 * Filter bar shared by the admin list screens.
 *
 * Filters live in the URL: a filtered view can be bookmarked, shared with the
 * other founder, and survives a refresh or a back button. Submitting goes
 * through the router inside a transition rather than a full page load, so the
 * table can dim while the new rows are fetched instead of the screen going
 * blank.
 *
 * The table is passed as `children` so it stays a server component — this
 * wrapper only needs to know it's there in order to dim it.
 */
export function FilterBar({
  action,
  hasFilters,
  searchPlaceholder,
  evenFields = false,
  children,
  table,
}: {
  action: string;
  hasFilters: boolean;
  searchPlaceholder: string;
  /**
   * Makes the search box share the row equally with the other fields instead
   * of absorbing all of the slack.
   *
   * By default search takes what's left, which is right when it is the main
   * filter. On screens where the real control is something wider — a date
   * range, say — that leaves search sprawling and the important field
   * squeezed. With this set, search and any sibling field carrying `flex-1`
   * and the same min-width divide the row between them.
   */
  evenFields?: boolean;
  /** The filter fields, beyond the search box. */
  children?: React.ReactNode;
  /** The table (or empty state) this bar filters. */
  table: React.ReactNode;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  // Every screen using this bar names its date bounds "from" and "to".
  const reversed = isReversedRange(params.get("from"), params.get("to"));

  const submit = (form: HTMLFormElement) => {
    const next = new URLSearchParams();
    for (const [key, value] of new FormData(form).entries()) {
      // Empty fields are left out entirely rather than written as `?q=` —
      // it keeps shared URLs readable and `hasFilters` honest.
      if (typeof value === "string" && value.trim()) next.set(key, value.trim());
    }
    // Deliberately not carrying `page` over: changing a filter changes how
    // many results there are, so page 4 of the old result set is meaningless.
    const qs = next.toString();
    startTransition(() => router.push(qs ? `${action}?${qs}` : action));
  };

  return (
    <>
      <form
        // Keyed on the live query string so Clear (and the back button)
        // actually empty the inputs instead of leaving stale text behind.
        key={params.toString()}
        action={action}
        onSubmit={(e) => {
          e.preventDefault();
          submit(e.currentTarget);
        }}
        className="flex flex-wrap items-end gap-2.5 border-b border-[#e3e7ee] bg-[#fcfdfe] px-5 py-3.5"
      >
        <label
          className={
            // flex-1 is `flex: 1 1 0%`, so two siblings that both carry it and
            // share a min-width divide the space evenly — that is what makes
            // the 50/50 split hold rather than approximately hold.
            "flex flex-col gap-1 " +
            (evenFields ? "min-w-[190px] flex-1" : "min-w-[240px] flex-1")
          }
        >
          <span className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[#8b96ad]">
            Search
          </span>
          <span className="flex items-center gap-2 rounded-lg border border-[#e3e7ee] bg-white px-3 py-[7px] focus-within:border-teal">
            <Search className="h-3.5 w-3.5 flex-none text-[#8b96ad]" />
            <input
              name="q"
              // This was hardcoded to "" — the search term vanished from the
              // box the moment you hit Apply, so you couldn't see what you
              // had searched for.
              defaultValue={params.get("q") ?? ""}
              placeholder={searchPlaceholder}
              className="w-full border-0 bg-transparent text-[0.86rem] outline-none"
            />
          </span>
        </label>

        {children}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-3.5 py-2 text-[0.83rem] font-medium text-cream hover:bg-[#1b2f56] disabled:opacity-60"
        >
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {pending ? "Applying…" : "Apply"}
        </button>

        {hasFilters && (
          <button
            type="button"
            onClick={() => startTransition(() => router.push(action))}
            className="px-1 pb-2 text-[0.82rem] text-[#5a6785] underline underline-offset-2 hover:text-navy"
          >
            Clear
          </button>
        )}
      </form>

      {/* A back-to-front range matches nothing, which on screen is
          indistinguishable from having no data. Say which it is. */}
      {reversed && (
        <p
          role="alert"
          className="flex items-start gap-2 border-b border-[#f0dcae] bg-[#fdf6e3] px-5 py-3 text-[0.84rem] text-[#7a4a00]"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" />
          The &ldquo;from&rdquo; date is after the &ldquo;to&rdquo; date, so nothing can match.
          Swap them to see results.
        </p>
      )}

      {/* aria-busy so a screen reader announces the wait; the dimming is only
          visible to people who can see it. */}
      <div
        aria-busy={pending}
        className={
          "relative transition-opacity " + (pending ? "pointer-events-none opacity-45" : "")
        }
      >
        {pending && (
          <div className="absolute inset-x-0 top-0 z-10 flex justify-center pt-10">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#e3e7ee] bg-white px-3.5 py-1.5 text-[0.8rem] font-medium text-[#5a6785] shadow-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </span>
          </div>
        )}
        {table}
      </div>
    </>
  );
}

export function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[#8b96ad]">
        {label}
      </span>
      {children}
    </label>
  );
}

export const filterInputClass =
  "rounded-lg border border-[#e3e7ee] bg-white px-3 py-[7px] text-[0.86rem] text-[#16203a] outline-none focus:border-teal";

export function FilterSelect({
  name,
  value,
  placeholder,
  options,
}: {
  name: string;
  value?: string;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select name={name} defaultValue={value ?? ""} className={filterInputClass}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
