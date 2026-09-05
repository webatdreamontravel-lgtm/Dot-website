"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseReviews, replaceReviews } from "@/lib/reviewsPayload";
import { deleteImages, keyFromUrl } from "@/lib/s3";
import { collectImageUrls, orphanedUrls, type TripImageFields } from "@/lib/tripImages";
import type { Prisma } from "@/lib/generated/prisma/client";

export type TripFormState = { error?: string; fieldErrors?: Record<string, string> };

/**
 * Every column that can hold an uploaded image URL. Selected before an update
 * so the save can work out what it orphaned.
 */
const IMAGE_FIELD_SELECT = {
  cardImage: true,
  heroImage: true,
  itinerary: true,
  introduction: true,
  inclusions: true,
  exclusions: true,
  thingsToKnow: true,
  cancellationPolicy: true,
} as const;

/**
 * Deletes stored images the save just orphaned — a replaced photo, one cleared
 * with Remove, a deleted itinerary day, an image taken out of a rich-text
 * field.
 *
 * Deliberately runs AFTER a successful write, comparing the row as it was
 * against the row as it now is. Deleting when the admin picks a new photo
 * would destroy the original for someone who then abandons the form.
 *
 * `keyFromUrl` returns null for anything not in our bucket, which is what
 * keeps Unsplash seed URLs and the legacy Supabase Storage images safe.
 *
 * Never throws: the trip is already saved, and failing the action over a
 * leftover object would report a successful save as an error.
 */
async function cleanUpOrphanedImages(
  before: TripImageFields,
  after: TripImageFields,
): Promise<void> {
  try {
    const removed = orphanedUrls(collectImageUrls(before), collectImageUrls(after));
    const keys = removed.map(keyFromUrl).filter((k): k is string => k !== null);
    if (keys.length === 0) return;

    const failed = await deleteImages(keys);
    if (failed.length > 0) {
      console.error("[trip images] could not delete orphaned objects:", failed);
    }
  } catch (e) {
    console.error("[trip images] cleanup failed:", e);
  }
}

/** Rupees in the form, paise in the database. Never store a float. */
const rupeesToPaise = (v: unknown) => Math.round(Number(v || 0) * 100);

const optionalJson = z
  .string()
  .optional()
  .transform((s) => {
    if (!s) return undefined;
    try {
      const parsed = JSON.parse(s);
      // An "empty" Tiptap doc is a single blank paragraph; store null so
      // the public page can skip the section entirely.
      if (parsed?.type === "doc" && isEmptyDoc(parsed)) return null;
      return parsed;
    } catch {
      return undefined;
    }
  });

function isEmptyDoc(doc: { content?: unknown[] }) {
  if (!Array.isArray(doc.content) || doc.content.length === 0) return true;
  return doc.content.every((n) => {
    const node = n as { type?: string; content?: unknown[] };
    return node.type === "paragraph" && (!node.content || node.content.length === 0);
  });
}

const schema = z
  .object({
    title: z.string().trim().min(3, "Give the trip a title"),
    batchName: z.string().trim().max(80, "Keep the batch name short").optional(),
    tagline: z.string().trim().optional(),
    category: z.string().trim().optional(),
    cardImage: z.string().trim().url("Card photo must be a URL").or(z.literal("")).optional(),
    heroImage: z.string().trim().url("Hero photo must be a URL").or(z.literal("")).optional(),

    startDate: z.string().min(1, "Pick a start date"),
    endDate: z.string().min(1, "Pick an end date"),
    startingFrom: z.string().trim().optional(),
    ageGroup: z.string().trim().optional(),

    totalSeats: z.coerce.number().int().min(1, "At least 1 seat"),
    minParticipants: z.coerce.number().int().min(1).default(1),

    price: z.coerce.number().min(0, "Price can't be negative"),
    comparePrice: z.coerce.number().min(0).optional(),
    offerLabel: z.string().trim().optional(),
    advance: z.coerce.number().min(0).optional(),
    gstPercent: z.coerce.number().int().min(0).max(100).default(5),
    tcsPercent: z.coerce.number().int().min(0).max(100).default(0),

    // Defaults TRUE: the form no longer posts this field, and an absent
    // checkbox must not silently switch a trip's payments off.
    razorpayEnabled: z.coerce.boolean().default(true),
    autoCloseWhenFull: z.coerce.boolean().default(true),
    showSeatsLeft: z.coerce.boolean().default(true),

    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
    isFeatured: z.coerce.boolean().default(false),

    introduction: optionalJson,
    itinerary: optionalJson,
    inclusions: optionalJson,
    exclusions: optionalJson,
    thingsToKnow: optionalJson,
    moodboard: optionalJson,
    cancellationPolicy: optionalJson,
  })
  .refine((d) => new Date(d.endDate) >= new Date(d.startDate), {
    message: "End date can't be before the start date",
    path: ["endDate"],
  })
  .refine((d) => !d.advance || d.advance <= d.price, {
    message: "Advance can't be more than the price",
    path: ["advance"],
  })
  .refine((d) => d.minParticipants <= d.totalSeats, {
    message: "Minimum can't exceed total seats",
    path: ["minParticipants"],
  });

/** "6 Days, 5 Nights". Mirrors the preview shown in the form. */
function describeDuration(start: string, end: string): string | null {
  const from = new Date(start);
  const to = new Date(end);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return null;

  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  const nights = days - 1;
  const label = `${days} ${days === 1 ? "Day" : "Days"}`;
  return nights > 0 ? `${label}, ${nights} ${nights === 1 ? "Night" : "Nights"}` : label;
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 70);
}

/** Appends -2, -3 … until the slug is free. */
async function uniqueSlug(base: string, ignoreId?: string) {
  let slug = base || "trip";
  for (let i = 1; i < 50; i++) {
    const clash = await prisma.trip.findFirst({
      where: { slug, ...(ignoreId ? { NOT: { id: ignoreId } } : {}) },
      select: { id: true },
    });
    if (!clash) return slug;
    slug = `${base}-${i + 1}`;
  }
  return `${base}-${Date.now()}`;
}

function parse(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  // Unchecked checkboxes simply aren't in FormData, so absence means false.
  for (const key of ["autoCloseWhenFull", "showSeatsLeft", "isFeatured"]) {
    raw[key] = formData.get(key) === "on" ? "true" : "";
  }
  return schema.safeParse(raw);
}

function toFieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

function buildData(d: z.infer<typeof schema>) {
  return {
    title: d.title,
    batchName: d.batchName || null,
    tagline: d.tagline || null,
    category: d.category || null,
    cardImage: d.cardImage || null,
    heroImage: d.heroImage || null,
    startDate: new Date(d.startDate),
    endDate: new Date(d.endDate),
    // Derived from the dates rather than typed, so it can't contradict them.
    durationLabel: describeDuration(d.startDate, d.endDate),
    startingFrom: d.startingFrom || null,
    ageGroup: d.ageGroup || null,
    minParticipants: d.minParticipants,
    pricePaise: rupeesToPaise(d.price),
    comparePricePaise: d.comparePrice ? rupeesToPaise(d.comparePrice) : null,
    offerLabel: d.offerLabel || null,
    advancePaise: d.advance ? rupeesToPaise(d.advance) : null,
    gstPercent: d.gstPercent,
    tcsPercent: d.tcsPercent,
    // Instalments were dropped from the product: the balance is collected in
    // one go before departure.
    instalmentCount: 0,
    razorpayEnabled: d.razorpayEnabled,
    autoCloseWhenFull: d.autoCloseWhenFull,
    showSeatsLeft: d.showSeatsLeft,
    status: d.status,
    isFeatured: d.isFeatured,
    publishedAt: d.status === "PUBLISHED" ? new Date() : null,
    ...(d.introduction !== undefined ? { introduction: d.introduction as Prisma.InputJsonValue } : {}),
    ...(d.itinerary !== undefined ? { itinerary: d.itinerary as Prisma.InputJsonValue } : {}),
    ...(d.inclusions !== undefined ? { inclusions: d.inclusions as Prisma.InputJsonValue } : {}),
    ...(d.exclusions !== undefined ? { exclusions: d.exclusions as Prisma.InputJsonValue } : {}),
    ...(d.thingsToKnow !== undefined ? { thingsToKnow: d.thingsToKnow as Prisma.InputJsonValue } : {}),
    ...(d.moodboard !== undefined ? { moodboard: d.moodboard as Prisma.InputJsonValue } : {}),
    ...(d.cancellationPolicy !== undefined ? { cancellationPolicy: d.cancellationPolicy as Prisma.InputJsonValue } : {}),
  };
}

/**
 * The master on/off switch for a trip, from the list.
 *
 * Deactivating does two things together, because they are one decision in
 * practice: it clears `isActive` AND archives the trip. Keeping a switched-off
 * trip sitting at "Live on site" was the confusing part — the badge claimed
 * one thing and the site did another. Archived says what actually happened.
 *
 * Reactivating puts it back to PUBLISHED, but only if it is currently
 * ARCHIVED. A DRAFT that gets switched on stays a DRAFT: it was never
 * finished, and silently publishing half-written copy is a worse outcome than
 * making someone set the status themselves.
 *
 * Neither direction touches bookings or seat counts. People who already
 * booked keep their booking and their /account link; the trip simply stops
 * being sellable. Cancelling a departure is a different decision and goes
 * through the bookings screen.
 */
export async function setTripActive(
  tripId: string,
  active: boolean,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { id: true, slug: true, status: true, isActive: true },
  });
  if (!trip) return { error: "That trip no longer exists." };
  if (trip.isActive === active) return {};

  const status = active
    ? trip.status === "ARCHIVED"
      ? ("PUBLISHED" as const)
      : trip.status
    : ("ARCHIVED" as const);

  await prisma.$transaction([
    prisma.trip.update({
      where: { id: tripId },
      data: {
        isActive: active,
        status,
        // Stamp the first time it actually goes live, and leave it alone
        // afterwards — the date should say when the trip first appeared, not
        // when it was last toggled.
        ...(active && status === "PUBLISHED" ? { publishedAt: new Date() } : {}),
      },
    }),
    prisma.auditLog.create({
      data: {
        actorProfileId: admin.id,
        action: active ? "trip.activate" : "trip.deactivate",
        entity: "trip",
        entityId: tripId,
        before: { isActive: trip.isActive, status: trip.status },
        after: { isActive: active, status },
      },
    }),
  ]);

  revalidatePath("/admin/trips");
  revalidatePath("/trips");
  revalidatePath(`/trips/${trip.slug}`);
  revalidatePath("/");
  return {};
}

export async function createTrip(
  _prev: TripFormState,
  formData: FormData,
): Promise<TripFormState> {
  const admin = await requireAdmin();
  const parsed = parse(formData);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const d = parsed.data;
  const slug = await uniqueSlug(slugify(d.title));

  let id: string;
  try {
    const trip = await prisma.trip.create({
      data: { slug, totalSeats: d.totalSeats, seatsBooked: 0, ...buildData(d) },
      select: { id: true },
    });
    id = trip.id;
  } catch (e) {
    return { error: `Couldn't save the trip: ${(e as Error).message}` };
  }

  // Reviews live in their own table, so they're written after the trip
  // exists and has an id.
  const reviews = parseReviews(formData.get("reviews"));
  if (reviews) await replaceReviews(id, reviews);

  await prisma.auditLog.create({
    data: { actorProfileId: admin.id, action: "trip.create", entity: "trip", entityId: id },
  });

  revalidatePath("/admin/trips");
  revalidatePath("/");
  redirect(`/admin/trips/${id}?saved=1`);
}

export async function updateTrip(
  _prev: TripFormState,
  formData: FormData,
): Promise<TripFormState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing trip id." };

  const parsed = parse(formData);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };
  const d = parsed.data;

  const existing = await prisma.trip.findUnique({
    where: { id },
    select: { seatsBooked: true, slug: true, ...IMAGE_FIELD_SELECT },
  });
  if (!existing) return { error: "That trip no longer exists." };

  // Capacity can't be cut below what's already sold — the database CHECK
  // would reject it anyway, but this gives a message a human understands.
  if (d.totalSeats < existing.seatsBooked) {
    return {
      fieldErrors: {
        totalSeats: `${existing.seatsBooked} seats are already booked — you can't set capacity below that.`,
      },
    };
  }

  // The slug is never edited after creation — changing it would break every
  // link already shared on WhatsApp.
  const slug = existing.slug;

  const data = buildData(d);

  try {
    await prisma.trip.update({
      data: { slug, totalSeats: d.totalSeats, ...data },
      where: { id },
    });
  } catch (e) {
    return { error: `Couldn't save the trip: ${(e as Error).message}` };
  }

  await cleanUpOrphanedImages(existing, { ...existing, ...data });

  const reviews = parseReviews(formData.get("reviews"));
  if (reviews) await replaceReviews(id, reviews);

  await prisma.auditLog.create({
    data: { actorProfileId: admin.id, action: "trip.update", entity: "trip", entityId: id },
  });

  revalidatePath("/admin/trips");
  revalidatePath(`/admin/trips/${id}`);
  revalidatePath("/");
  revalidatePath(`/trips/${slug}`);

  // React 19 resets uncontrolled fields to their defaultValue once a form
  // action finishes. Returning normally here leaves the form showing the
  // values from the previous server render — so a trip you just published
  // snaps back to "Draft" even though the database saved it correctly.
  // Redirecting forces a fresh render, and the form then reflects reality.
  redirect(`/admin/trips/${id}?saved=1`);
}
