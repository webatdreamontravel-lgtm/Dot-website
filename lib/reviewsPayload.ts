import "server-only";

import { z } from "zod";

import { prisma } from "@/lib/prisma";

/**
 * Shared parsing + persistence for the reviews editor.
 *
 * Used by both the global Reviews tab and the per-trip reviews section, so
 * the validation rules and the write strategy can't drift between them.
 */

export const MAX_REVIEWS = 3;

const reviewSchema = z.object({
  authorName: z.string().trim().min(1).max(80),
  tripTitle: z.string().trim().max(120).optional().default(""),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().trim().min(1).max(400),
});

export type ParsedReview = z.infer<typeof reviewSchema>;

/** Returns [] for anything unparseable — a broken payload shouldn't wipe
 *  reviews silently, so callers check for `undefined` to mean "not sent". */
export function parseReviews(raw: unknown): ParsedReview[] | undefined {
  if (typeof raw !== "string" || raw === "") return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return undefined;
    const result = z.array(reviewSchema).max(MAX_REVIEWS).safeParse(parsed);
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Replaces the review set for one scope.
 *
 * Replace-all rather than diffing: there are at most three, they carry no
 * relationships, and the editor already sends the complete desired state.
 * Diffing would be more code and more ways to end up with a stale row.
 *
 * `tripId: null` is the global set shown on the homepage.
 */
export async function replaceReviews(
  tripId: string | null,
  reviews: ParsedReview[],
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.review.deleteMany({ where: { tripId } });

    if (reviews.length === 0) return;

    await tx.review.createMany({
      data: reviews.map((r, i) => ({
        tripId,
        authorName: r.authorName,
        tripTitleSnapshot: r.tripTitle || null,
        rating: r.rating,
        body: r.body,
        // Admin-authored, so no booking backs it. isVerified stays false
        // until reviews are collected from real travellers.
        isVerified: false,
        isPublished: true,
        sortOrder: i,
      })),
    });
  });
}

/** Shape the editor expects back when loading existing reviews. */
export async function getReviewDrafts(tripId: string | null) {
  const rows = await prisma.review.findMany({
    where: { tripId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    take: MAX_REVIEWS,
    select: { authorName: true, tripTitleSnapshot: true, rating: true, body: true },
  });

  return rows.map((r) => ({
    authorName: r.authorName,
    tripTitle: r.tripTitleSnapshot ?? "",
    rating: r.rating,
    body: r.body,
  }));
}
