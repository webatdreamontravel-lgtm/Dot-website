import { requireAdmin } from "@/lib/auth";
import { getReviewDrafts, MAX_REVIEWS } from "@/lib/reviewsPayload";
import { Panel } from "../ui";
import { ReviewsForm } from "./ReviewsForm";

export const metadata = { title: "Reviews" };

export default async function AdminReviewsPage() {
  await requireAdmin();
  const reviews = await getReviewDrafts(null);

  return (
    <>
      <header className="mb-6">
        <h1 className="font-display text-[1.85rem] font-semibold tracking-tight">Reviews</h1>
        <p className="mt-0.5 text-[0.85rem] text-[#8b96ad]">
          Up to {MAX_REVIEWS} shown on the homepage. Reviews for a specific trip are
          added on that trip instead.
        </p>
      </header>

      <Panel title="Homepage reviews">
        <div className="p-5">
          <ReviewsForm reviews={reviews} />
        </div>
      </Panel>
    </>
  );
}
