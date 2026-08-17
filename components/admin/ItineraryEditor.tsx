"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from "lucide-react";

import { ImageUpload } from "@/components/admin/ImageUpload";
import { RichTextEditor } from "@/components/admin/RichTextEditor";

export type ItineraryDay = {
  dayNumber: number;
  dayLabel: string;
  date: string;
  title: string;
  body: unknown;
  image?: string | null;
};

type Row = ItineraryDay & { key: string };

const emptyDoc = () => ({ type: "doc", content: [{ type: "paragraph" }] });

/**
 * Day-by-day itinerary builder.
 *
 * Serialises the whole array into one hidden input rather than giving each
 * day its own form fields. Reordering with indexed field names is a classic
 * source of scrambled data — moving day 2 above day 1 would have to rename
 * every input — whereas a single JSON payload always reflects exactly what's
 * on screen.
 *
 * dayNumber is derived from position on every render, so "Day 3" can never
 * end up sitting above "Day 2".
 */
export function ItineraryEditor({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue?: unknown;
}) {
  const [rows, setRows] = useState<Row[]>(() => normalise(defaultValue));

  const serialised = useMemo(
    () =>
      JSON.stringify(
        rows.map((r, i) => ({
          dayNumber: i + 1,
          dayLabel: `DAY ${i + 1}`,
          date: r.date,
          title: r.title,
          body: r.body,
          image: r.image || null,
        })),
      ),
    [rows],
  );

  const patch = useCallback((key: string, changes: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...changes } : r)));
  }, []);

  const move = (index: number, direction: -1 | 1) => {
    setRows((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const addDay = () =>
    setRows((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        dayNumber: prev.length + 1,
        dayLabel: `DAY ${prev.length + 1}`,
        date: "",
        title: "",
        body: emptyDoc(),
        image: null,
      },
    ]);

  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 && (
        <p className="rounded-xl border border-dashed border-[#e3e7ee] bg-[#fcfdfe] px-4 py-8 text-center text-[0.85rem] text-[#8b96ad]">
          No days yet. Add Day 1 to start building the itinerary.
        </p>
      )}

      {rows.map((row, i) => (
        <div key={row.key} className="overflow-hidden rounded-xl border border-[#e3e7ee] bg-white">
          <div className="flex items-center gap-2.5 border-b border-[#e3e7ee] bg-[#fbfcfe] px-3 py-2">
            <GripVertical className="h-4 w-4 flex-none text-[#c3cad8]" />
            <span className="grid h-7 w-12 flex-none place-items-center rounded-md bg-navy text-[0.72rem] font-bold tracking-wide text-cream">
              DAY {i + 1}
            </span>

            <input
              value={row.title}
              onChange={(e) => patch(row.key, { title: e.target.value })}
              placeholder="What happens on this day?"
              className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-[0.88rem] font-semibold outline-none transition hover:border-[#e3e7ee] focus:border-teal focus:bg-white"
            />

            <input
              value={row.date}
              onChange={(e) => patch(row.key, { date: e.target.value })}
              placeholder="29 Sep · Monday"
              className="w-[150px] flex-none rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-right text-[0.8rem] text-[#5a6785] outline-none transition hover:border-[#e3e7ee] focus:border-teal focus:bg-white"
            />

            <span className="flex flex-none items-center gap-0.5">
              <IconBtn label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                <ChevronUp className="h-3.5 w-3.5" />
              </IconBtn>
              <IconBtn label="Move down" disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                <ChevronDown className="h-3.5 w-3.5" />
              </IconBtn>
              <IconBtn
                label="Delete this day"
                danger
                onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </IconBtn>
            </span>
          </div>

          <div className="grid gap-3 p-3 md:grid-cols-[1fr_190px]">
            <RichTextEditor
              defaultValue={row.body}
              minHeight={110}
              onChange={(doc) => patch(row.key, { body: doc })}
            />
            <ImageUpload
              slot={`day-${i + 1}`}
              aspect="4 / 3"
              compact
              defaultValue={row.image}
              onChange={(url) => patch(row.key, { image: url })}
            />
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addDay}
        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#c3cad8] px-4 py-2.5 text-[0.85rem] font-medium text-[#5a6785] transition hover:border-teal hover:bg-teal/[0.05] hover:text-navy"
      >
        <Plus className="h-4 w-4" />
        Add day {rows.length + 1}
      </button>

      <input type="hidden" name={name} value={serialised} readOnly />
    </div>
  );
}

function IconBtn({
  label, onClick, disabled, danger, children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={
        "grid h-7 w-7 place-items-center rounded-md transition disabled:opacity-30 " +
        (danger
          ? "text-[#c33a3a] hover:bg-[#fdeaea]"
          : "text-[#5a6785] hover:bg-[#eef1f6] hover:text-[#16203a]")
      }
    >
      {children}
    </button>
  );
}

/** Tolerates whatever shape is already stored, including nothing at all. */
function normalise(value: unknown): Row[] {
  if (!Array.isArray(value)) return [];
  return value.map((d, i) => {
    const day = (d ?? {}) as Partial<ItineraryDay>;
    return {
      key: crypto.randomUUID(),
      dayNumber: i + 1,
      dayLabel: `DAY ${i + 1}`,
      date: typeof day.date === "string" ? day.date : "",
      title: typeof day.title === "string" ? day.title : "",
      body: day.body ?? emptyDoc(),
      image: typeof day.image === "string" ? day.image : null,
    };
  });
}
