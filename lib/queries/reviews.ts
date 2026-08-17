import "server-only";

import { prisma } from "@/lib/prisma";

export type ReviewView = {
  id: string;
  authorName: string;
  rating: number;
  body: string;
  tripTitle: string | null;
  isVerified: boolean;
};

/** Published reviews only — unmoderated ones must never reach the site. */
export async function getPublishedReviews(limit = 6): Promise<ReviewView[]> {
  const rows = await prisma.review.findMany({
    // tripId null = the homepage set. Trip-specific reviews belong on
    // their own page, not mixed into the homepage carousel.
    where: { isPublished: true, tripId: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      authorName: true,
      rating: true,
      body: true,
      tripTitleSnapshot: true,
      isVerified: true,
      trip: { select: { title: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    authorName: r.authorName,
    rating: r.rating,
    body: r.body,
    // Prefer the snapshot: an archived or renamed trip should still read
    // the way it did when the review was written.
    tripTitle: r.tripTitleSnapshot ?? r.trip?.title ?? null,
    isVerified: r.isVerified,
  }));
}
