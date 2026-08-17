"use client";

import { useMemo, useState } from "react";
import { Plus, Star, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";

export type ReviewDraft = {
  authorName: string;
  tripTitle: string;
  rating: number;
  body: string;
};

type Row = ReviewDraft & { key: string };

export const MAX_REVIEWS = 3;

/**
 * Up to three short reviews, serialised into one hidden field.
 *
 * No photo upload by design: a review is words and a name. Avatars mean
 * sourcing a headshot for every quote, which is exactly the kind of chore
 * that stops the team publishing reviews at all.
 */
export function ReviewsEditor({
  name,
  defaultValue,
  tripTitlePlaceholder = "Spiti Valley Saga · 2025",
}: {
  name: string;
  defaultValue?: unknown;
  tripTitlePlaceholder?: string;
}) {
  const [rows, setRows] = useState<Row[]>(() => normalise(defaultValue));

  const serialised = useMemo(
    () =>
      JSON.stringify(
        rows
          // A review with no words is not a review — drop it rather than
          // publishing an empty card.
          .filter((r) => r.body.trim() && r.authorName.trim())
          .map(({ authorName, tripTitle, rating, body }) => ({
            authorName: authorName.trim(),
            tripTitle: tripTitle.trim(),
            rating,
            body: body.trim(),
          })),
      ),
    [rows],
  );

  const patch = (key: string, changes: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...changes } : r)));

  const add = () =>
    setRows((prev) =>
      prev.length >= MAX_REVIEWS
        ? prev
        : [...prev, { key: crypto.randomUUID(), authorName: "", tripTitle: "", rating: 5, body: "" }],
    );

  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 && (
        <p className="rounded-xl border border-dashed border-[#e3e7ee] bg-[#fcfdfe] px-4 py-8 text-center text-[0.85rem] text-[#8b96ad]">
          No reviews yet. Add up to {MAX_REVIEWS}.
        </p>
      )}

      {rows.map((row, i) => (
        <div key={row.key} className="rounded-xl border border-[#e3e7ee] bg-white p-4">
          <div className="mb-3 flex items-center gap-3">
            <span className="text-[0.78rem] font-semibold uppercase tracking-[0.08em] text-[#8b96ad]">
              Review {i + 1}
            </span>
            <Stars value={row.rating} onChange={(rating) => patch(row.key, { rating })} />
            <button
              type="button"
              aria-label="Remove this review"
              onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
              className="ml-auto grid h-7 w-7 place-items-center rounded-md text-[#c33a3a] transition hover:bg-[#fdeaea]"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <textarea
            value={row.body}
            onChange={(e) => patch(row.key, { body: e.target.value })}
            rows={3}
            maxLength={400}
            placeholder="What did they say about the trip?"
            className="w-full rounded-lg border border-[#e3e7ee] px-3 py-2.5 text-[0.9rem] leading-relaxed outline-none transition focus:border-teal focus:ring-[3px] focus:ring-teal/12"
          />
          <div className="mt-1 text-right text-[0.72rem] text-[#c3cad8]">
            {row.body.length}/400
          </div>

          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <input
              value={row.authorName}
              onChange={(e) => patch(row.key, { authorName: e.target.value })}
              placeholder="Traveller's name"
              className="rounded-lg border border-[#e3e7ee] px-3 py-2 text-[0.88rem] outline-none focus:border-teal"
            />
            <input
              value={row.tripTitle}
              onChange={(e) => patch(row.key, { tripTitle: e.target.value })}
              placeholder={tripTitlePlaceholder}
              className="rounded-lg border border-[#e3e7ee] px-3 py-2 text-[0.88rem] outline-none focus:border-teal"
            />
          </div>
        </div>
      ))}

      {rows.length < MAX_REVIEWS ? (
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#c3cad8] px-4 py-2.5 text-[0.85rem] font-medium text-[#5a6785] transition hover:border-teal hover:bg-teal/[0.05] hover:text-navy"
        >
          <Plus className="h-4 w-4" />
          Add review {rows.length + 1} of {MAX_REVIEWS}
        </button>
      ) : (
        <p className="text-center text-[0.8rem] text-[#8b96ad]">
          {MAX_REVIEWS} of {MAX_REVIEWS} added — remove one to add another.
        </p>
      )}

      <input type="hidden" name={name} value={serialised} readOnly />
    </div>
  );
}

function Stars({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          onClick={() => onChange(n)}
          className="p-0.5"
        >
          <Star
            className={cn(
              "h-4 w-4 transition",
              n <= value ? "fill-[#f4c542] text-[#f4c542]" : "text-[#d7dce5]",
            )}
          />
        </button>
      ))}
    </span>
  );
}

function normalise(value: unknown): Row[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_REVIEWS).map((r) => {
    const v = (r ?? {}) as Partial<ReviewDraft>;
    return {
      key: crypto.randomUUID(),
      authorName: typeof v.authorName === "string" ? v.authorName : "",
      tripTitle: typeof v.tripTitle === "string" ? v.tripTitle : "",
      rating: typeof v.rating === "number" ? Math.min(Math.max(v.rating, 1), 5) : 5,
      body: typeof v.body === "string" ? v.body : "",
    };
  });
}
