"use client";

import { useState } from "react";
import DatePicker from "react-datepicker";
import { CalendarDays, X } from "lucide-react";
import "react-datepicker/dist/react-datepicker.css";

import { cn } from "@/lib/utils";

/**
 * Date range field for the admin filter bars.
 *
 * The ONLY place react-datepicker is imported. Feature code takes this
 * component and never the library, so swapping the picker again — as we just
 * did — is one file, not a sweep. The stylesheet is imported here too, for the
 * same reason: nothing else should have to know it exists.
 *
 * Submits two hidden inputs named `from` and `to`, so every server component
 * already reading `searchParams.from` / `.to` keeps working unchanged, and it
 * drops into the existing <FilterBar> form with no plumbing.
 */
export function DateRangeField({
  from,
  to,
  label = "Date range",
  disabled,
  maxDate,
  className,
}: {
  /** `YYYY-MM-DD`. */
  from?: string;
  to?: string;
  label?: string;
  disabled?: boolean;
  /** Defaults to today — most admin ranges are historical. */
  maxDate?: Date | null;
  /** Sizing for the field within its filter bar, e.g. "min-w-[280px] flex-1". */
  className?: string;
}) {
  const [start, setStart] = useState<Date | null>(parseISO(from));
  const [end, setEnd] = useState<Date | null>(parseISO(to));

  const clear = () => {
    setStart(null);
    setEnd(null);
  };

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[#8b96ad]">
        {label}
      </span>

      {/* What the form actually submits. The picker itself is presentational. */}
      <input type="hidden" name="from" value={toISO(start)} />
      <input type="hidden" name="to" value={toISO(end)} />

      <div className="relative flex items-center gap-1">
        {/* Absolute inside the relative row: react-datepicker wraps its input
            in its own element, so the icon can't be a sibling in flow. */}
        <CalendarDays className="pointer-events-none absolute left-3 z-[1] h-3.5 w-3.5 text-[#8b96ad]" />

        <DatePicker
          wrapperClassName="flex-1"
          selectsRange
          startDate={start}
          endDate={end}
          onChange={([nextStart, nextEnd]) => {
            setStart(nextStart);
            setEnd(nextEnd);
          }}
          monthsShown={2}
          // Settlements and bookings can't be in the future, and offering
          // those dates only ever produces an empty result.
          maxDate={maxDate === null ? undefined : (maxDate ?? new Date())}
          disabled={disabled}
          dateFormat="d MMM yy"
          placeholderText="Any date"
          // Portalled so the popover isn't clipped by the filter bar's
          // overflow, and doesn't push the table down when it opens.
          withPortal={false}
          popperPlacement="bottom-start"
          showPopperArrow={false}
          calendarClassName="dot-datepicker"
          className={cn(
            "w-full rounded-lg border border-[#e3e7ee] bg-white py-[7px] pl-8 pr-3 text-[0.86rem] text-navy outline-none transition",
            "focus:border-teal hover:border-[#c3cad8]",
            disabled && "cursor-not-allowed opacity-50",
          )}
        />

        {(start || end) && !disabled && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear date range"
            className="grid h-7 w-7 flex-none place-items-center rounded-lg text-[#8b96ad] transition hover:bg-[#f1f4f8] hover:text-navy"
          >
            <X className="h-3.5 w-3.5" />
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
