/**
 * Client-side upload helper. Shared by the photo slots, the itinerary day
 * photos and the in-editor image button so compression, size limits and
 * error handling behave identically everywhere.
 */

export type UploadResult = { url: string; path: string } | { error: string };

/** What a person is allowed to pick. Deliberately narrow. */
export const ACCEPTED_INPUT = ["image/jpeg", "image/png"] as const;
export const ACCEPT_ATTRIBUTE = "image/jpeg,image/png,.jpg,.jpeg,.png";

/**
 * Largest photo somebody may choose, measured on the ORIGINAL file.
 *
 * Checked in the browser before any resizing, so an oversized photo is
 * refused instantly instead of after a long upload. The server enforces the
 * same number independently.
 */
export const MAX_UPLOAD_MB = 10;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/**
 * Longest edge kept per slot, matched to how big the photo is ever shown.
 *
 * Storing a 2560px master for a card that renders ~450px wide is pure waste
 * — the visitor never sees that detail, and it's storage you pay for on
 * every trip. The hero is the exception: it's full-bleed, so on a retina
 * laptop it genuinely needs the pixels.
 */
const MAX_EDGE: Record<string, number> = {
  hero: 2560,
  card: 1600,
  inline: 1800,
};

function maxEdgeFor(slot: string): number {
  if (slot.startsWith("day-")) return 1800;
  return MAX_EDGE[slot] ?? 1800;
}

export async function uploadImage(file: File, slot: string): Promise<UploadResult> {
  if (!ACCEPTED_INPUT.includes(file.type as (typeof ACCEPTED_INPUT)[number])) {
    return { error: "Only JPG and PNG photos can be uploaded." };
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      error: `That photo is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is ${MAX_UPLOAD_MB} MB. Try a smaller version.`,
    };
  }

  try {
    const prepared = await compress(file, maxEdgeFor(slot));
    const body = new FormData();
    body.append("file", prepared);
    body.append("slot", slot);
    // The server can't tell what was originally picked once we've converted
    // it, so the original type travels with the request and is re-checked
    // there. Client-side validation alone is not enforcement.
    body.append("originalType", file.type);

    const res = await fetch("/api/admin/upload", { method: "POST", body });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) return { error: json.error ?? "Upload failed. Try again." };
    return { url: json.url, path: json.path };
  } catch {
    return { error: "Upload failed — check your connection and try again." };
  }
}

/**
 * Downscales and re-encodes as WebP before upload.
 *
 * This produces a MASTER, not the final delivered image — next/image
 * re-encodes again on the way to the browser. Compressing hard here would
 * mean two lossy passes stacked on top of each other, which visibly softens
 * detail while saving almost nothing. So: resize aggressively, compress
 * gently.
 *
 * WebP is the storage format even though only JPG/PNG can be uploaded — it's
 * roughly 30% smaller than JPEG at the same quality and is supported by
 * every browser that matters.
 *
 * Returns the original file if anything fails — a slightly large upload
 * beats a failed one.
 */
export async function compress(file: File, maxEdge = 2560, quality = 0.9): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality),
    );
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", {
      type: "image/webp",
    });
  } catch {
    return file;
  }
}
