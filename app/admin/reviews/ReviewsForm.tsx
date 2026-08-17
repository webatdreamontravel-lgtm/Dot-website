"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

import { ReviewsEditor, type ReviewDraft } from "@/components/admin/ReviewsEditor";

import { saveGlobalReviews, type ReviewsFormState } from "./actions";

export function ReviewsForm({ reviews }: { reviews: ReviewDraft[] }) {
  const [state, submit, pending] = useActionState<ReviewsFormState, FormData>(
    saveGlobalReviews,
    {},
  );

  return (
    <form action={submit}>
      {state.error && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-[#f0cfcf] bg-[#fdeaea] px-4 py-3 text-[0.86rem] text-[#c33a3a]">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
          {state.error}
        </div>
      )}
      {state.saved && !state.error && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-[#bfe6d3] bg-[#e6f5ee] px-4 py-3 text-[0.86rem] text-[#0f8a5f]">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" />
          Saved. These are live on the homepage now.
        </div>
      )}

      <ReviewsEditor name="reviews" defaultValue={reviews} />

      <div className="mt-5 flex items-center gap-3">
        <span className="text-[0.82rem] text-[#8b96ad]">
          Shown at the bottom of the homepage
        </span>
        <button
          type="submit"
          disabled={pending}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-[0.85rem] font-medium text-cream hover:bg-[#1b2f56] disabled:opacity-60"
        >
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {pending ? "Saving…" : "Save reviews"}
        </button>
      </div>
    </form>
  );
}
