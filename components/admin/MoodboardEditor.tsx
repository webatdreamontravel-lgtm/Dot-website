"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";

export type MoodEntry = { label: string; value: number };

type Row = MoodEntry & { key: string };

export const MAX_MOODS = 8;
export const MOOD_SCALE = 5;

/**
 * The dimensions most trips want, offered as a starting point.
 *
 * Pre-filling beats an empty list here: staring at "add a dimension" invites
 * inventing inconsistent labels per trip, which makes the moodboard useless
 * for comparing one trip against another.
 */
const SUGGESTED: MoodEntry[] = [
  { label: "Leisure", value: 3 },
  { label: "City & Culture", value: 3 },
  { label: "Nature", value: 3 },
  { label: "Adventure", value: 3 },
  { label: "History & Heritage", value: 3 },
  { label: "Physical Effort", value: 2 },
];

export function MoodboardEditor({
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
        rows
          .filter((r) => r.label.trim())
          .map(({ label, value }) => ({ label: label.trim(), value })),
      ),
    [rows],
  );

  const patch = (key: string, changes: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...changes } : r)));

  const add = (entry?: MoodEntry) =>
    setRows((prev) =>
      prev.length >= MAX_MOODS
        ? prev
        : [...prev, { key: crypto.randomUUID(), label: entry?.label ?? "", value: entry?.value ?? 3 }],
    );

  const used = new Set(rows.map((r) => r.label.trim().toLowerCase()));
  const remaining = SUGGESTED.filter((s) => !used.has(s.label.toLowerCase()));

  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-[#e3e7ee] bg-[#fcfdfe] px-4 py-6 text-center">
          <p className="text-[0.85rem] text-[#8b96ad]">
            Nothing yet — the moodboard won&apos;t appear on the trip page.
          </p>
          <button
            type="button"
            onClick={() => setRows(SUGGESTED.map((s) => ({ ...s, key: crypto.randomUUID() })))}
            className="mt-3 rounded-lg bg-navy px-3.5 py-2 text-[0.83rem] font-medium text-cream hover:bg-[#1b2f56]"
          >
            Start with the usual six
          </button>
        </div>
      )}

      {rows.map((row) => (
        <div
          key={row.key}
          className="flex flex-wrap items-center gap-3 rounded-xl border border-[#e3e7ee] bg-white px-3.5 py-2.5"
        >
          <input
            value={row.label}
            onChange={(e) => patch(row.key, { label: e.target.value })}
            placeholder="Dimension, e.g. Nature"
            className="min-w-[150px] flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-[0.88rem] font-medium outline-none transition hover:border-[#e3e7ee] focus:border-teal focus:bg-white"
          />

          <Dots value={row.value} onChange={(value) => patch(row.key, { value })} />

          <span className="w-8 text-right text-[0.8rem] tabular-nums text-[#8b96ad]">
            {row.value}/{MOOD_SCALE}
          </span>

          <button
            type="button"
            aria-label={`Remove ${row.label || "this row"}`}
            onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
            className="grid h-7 w-7 place-items-center rounded-md text-[#c33a3a] transition hover:bg-[#fdeaea]"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      {rows.length > 0 && rows.length < MAX_MOODS && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => add()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[#c3cad8] px-3 py-2 text-[0.83rem] font-medium text-[#5a6785] transition hover:border-teal hover:text-navy"
          >
            <Plus className="h-3.5 w-3.5" /> Add your own
          </button>
          {remaining.slice(0, 4).map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border border-[#e3e7ee] px-3 py-1.5 text-[0.8rem] text-[#5a6785] transition hover:border-teal hover:text-navy"
            >
              + {s.label}
            </button>
          ))}
        </div>
      )}

      <input type="hidden" name={name} value={serialised} readOnly />
    </div>
  );
}

function Dots({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <span className="flex items-center gap-1.5">
      {Array.from({ length: MOOD_SCALE }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} of ${MOOD_SCALE}`}
          // Clicking the current value clears down to it minus one, so a
          // rating can be lowered to zero without a separate control.
          onClick={() => onChange(n === value ? n - 1 : n)}
          className={cn(
            "h-4 w-4 rounded-full transition",
            n <= value ? "bg-navy" : "bg-[#e3e7ee] hover:bg-[#c3cad8]",
          )}
        />
      ))}
    </span>
  );
}

function normalise(value: unknown): Row[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_MOODS).map((m) => {
    const v = (m ?? {}) as Partial<MoodEntry>;
    return {
      key: crypto.randomUUID(),
      label: typeof v.label === "string" ? v.label : "",
      value:
        typeof v.value === "number" ? Math.min(Math.max(Math.round(v.value), 0), MOOD_SCALE) : 3,
    };
  });
}
