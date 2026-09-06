"use client";

import { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import { CalendarDays, X } from "lucide-react";
import "react-datepicker/dist/react-datepicker.css";

import { cn } from "@/lib/utils";

/**
 * Date range field, for admin filter bars and the public trip listing.
 *
 * The ONLY place react-datepicker is imported. Feature code takes this
 * component and never the library, so swapping the picker again — as we
 * already did once — is one file, not a sweep. The stylesheet is imported
 * here too, for the same reason: nothing else should have to know it exists.
 *
 * Two ways to read the value, because the two callers work differently:
 *
 *   Hidden inputs named `from` and `to` — the admin bars are forms, and this
 *   drops into one with no plumbing.
 *
 *   `onChange`, for the public listing, which writes straight to the URL as
 *   the range is picked rather than waiting for an Apply button.
 *
 * `tone` is the only styling knob. The admin is dense and monochrome; the
 * public site is cream, larger, and has to clear a 44px touch target. Rather
 * than let call sites pass class names — which is how two components end up
 * looking like three — the two looks live here and are named.
 */
export function DateRangeField({
  from,
  to,
  label = "Date range",
  placeholder = "Any date",
  disabled,
  minDate,
  maxDate,
  tone = "admin",
  className,
  onChange,
}: {
  /** `YYYY-MM-DD`. */
  from?: string;
  to?: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Earliest selectable day. Upcoming-trip filters want today. */
  minDate?: Date;
  /** Defaults to today — most admin ranges are historical. */
  maxDate?: Date | null;
  tone?: "admin" | "public";
  /** Sizing for the field within its filter bar, e.g. "min-w-[280px] flex-1". */
  className?: string;
  /** Called with `YYYY-MM-DD` (or "") whenever the range changes. */
  onChange?: (range: { from: string; to: string }) => void;
}) {
  const [start, setStart] = useState<Date | null>(parseISO(from));
  const [end, setEnd] = useState<Date | null>(parseISO(to));
  const isPublic = tone === "public";

  /**
   * Two months side by side is 560px of calendar, which on a 375px screen
   * runs off the edge — and `.dot-datepicker` is an inline-flex, so the
   * second month has nowhere to wrap to.
   *
   * Starts at 1 and widens after mount rather than reading the viewport
   * during render, so the server and the first client render agree.
   */
  const [months, setMonths] = useState(1);
  useEffect(() => {
    if (!isPublic) return;
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setMonths(mq.matches ? 2 : 1);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [isPublic]);

  const clear = () => {
    setStart(null);
    setEnd(null);
    onChange?.({ from: "", to: "" });
  };

  return (
    <div className={cn("flex flex-col", isPublic ? "gap-0.5" : "gap-1", className)}>
      <span
        className={
          isPublic
            ? "text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-navy/65"
            : "text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[#8b96ad]"
        }
      >
        {label}
      </span>

      {/* What the form actually submits. The picker itself is presentational. */}
      <input type="hidden" name="from" value={toISO(start)} />
      <input type="hidden" name="to" value={toISO(end)} />

      <div className="relative flex items-center gap-1">
        {/* Absolute inside the relative row: react-datepicker wraps its input
            in its own element, so the icon can't be a sibling in flow. */}
        {/* The public tone sits inside the search capsule, which supplies the
            border, the padding and the focus ring — so the field itself has
            no chrome and no leading icon to compete with the segment label. */}
        {!isPublic && (
          <CalendarDays className="pointer-events-none absolute left-3 z-[1] h-3.5 w-3.5 flex-none text-[#8b96ad]" />
        )}

        <DatePicker
          wrapperClassName="flex-1"
          selectsRange
          startDate={start}
          endDate={end}
          onChange={([nextStart, nextEnd]) => {
            setStart(nextStart);
            setEnd(nextEnd);
            // Only once both ends are set, or the URL would be rewritten
            // mid-pick with a half-open range and the grid would flash a
            // result set nobody asked for.
            if (!nextStart || nextEnd) {
              onChange?.({ from: toISO(nextStart), to: toISO(nextEnd) });
            }
          }}
          monthsShown={isPublic ? months : 2}
          minDate={minDate}
          // Settlements and bookings can't be in the future, and offering
          // those dates only ever produces an empty result.
          maxDate={maxDate === null ? undefined : (maxDate ?? new Date())}
          disabled={disabled}
          dateFormat="d MMM yy"
          placeholderText={placeholder}
          withPortal={false}
          /**
           * Rendered at document.body on the public page, positioning intact.
           *
           * The trip hero is `isolate overflow-hidden` — it has to be, or its
           * backdrop layers escape behind the page. That traps the calendar
           * twice over: the section becomes its own stacking context, so no
           * z-index can lift the popover above the fixed navbar, and the
           * overflow clips whatever hangs outside the hero.
           *
           * Both showed up in the same bug. Scrolled down, the field sits low
           * enough that floating-ui flips the calendar upward, and its top
           * band slid under the navbar: two months of dates with no month
           * name and no weekday row.
           */
          portalId={isPublic ? "dot-datepicker-portal" : undefined}
          popperPlacement={isPublic ? "bottom-end" : "bottom-start"}
          showPopperArrow={false}
          calendarClassName={isPublic ? "dot-datepicker dot-datepicker--lg" : "dot-datepicker"}
          className={cn(
            "w-full text-navy outline-none transition",
            isPublic
              ? "cursor-pointer border-0 bg-transparent p-0 text-[0.95rem] placeholder:text-navy/65"
              : "rounded-lg border border-[#e3e7ee] bg-white py-[7px] pl-8 pr-3 text-[0.86rem] hover:border-[#c3cad8] focus:border-teal",
            disabled && "cursor-not-allowed opacity-50",
          )}
        />

        {(start || end) && !disabled && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear date range"
            className={cn(
              "grid flex-none place-items-center rounded-lg transition",
              isPublic
                ? "-my-1 h-9 w-9 cursor-pointer text-navy/55 hover:bg-navy/5 hover:text-navy"
                : "h-7 w-7 text-[#8b96ad] hover:bg-[#f1f4f8] hover:text-navy",
            )}
          >
            <X className={isPublic ? "h-4 w-4" : "h-3.5 w-3.5"} />
          </button>
        )}
      </div>
    </div>
  );
}

/** `YYYY-MM-DD` → Date, read as a plain calendar day. */
function parseISO(value?: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/**
 * Date → `YYYY-MM-DD` from LOCAL parts.
 *
 * Not toISOString(): that converts to UTC first, so a date picked in IST
 * before 05:30 comes back as the previous day — the calendar would show one
 * date and the filter would use another.
 */
function toISO(date: Date | null): string {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
