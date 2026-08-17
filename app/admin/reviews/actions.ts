"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseReviews, replaceReviews } from "@/lib/reviewsPayload";

export type ReviewsFormState = { error?: string; saved?: boolean };

/** Saves the homepage review set (tripId null). */
export async function saveGlobalReviews(
  _prev: ReviewsFormState,
  formData: FormData,
): Promise<ReviewsFormState> {
  const admin = await requireAdmin();

  const reviews = parseReviews(formData.get("reviews"));
  if (reviews === undefined) {
    return { error: "Couldn't read the reviews — please try saving again." };
  }

  try {
    await replaceReviews(null, reviews);
  } catch (e) {
    return { error: `Couldn't save: ${(e as Error).message}` };
  }

  await prisma.auditLog.create({
    data: {
      actorProfileId: admin.id,
      action: "reviews.update",
      entity: "review",
      after: { count: reviews.length },
    },
  });

  revalidatePath("/admin/reviews");
  revalidatePath("/");

  return { saved: true };
}
