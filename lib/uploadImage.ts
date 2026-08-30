/**
 * Client-side upload helper. Shared by the photo slots, the itinerary day
 * photos and the in-editor image button so compression, size limits and
 * error handling behave identically everywhere.
 */

import imageCompression from "browser-image-compression";

import {
  formatMb,
  MAX_STORED_BYTES,
  MAX_STORED_MB,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_MB,
} from "@/lib/imageConfig";

export type UploadResult = { url: string; key: string } | { error: string };

/** What a person is allowed to pick. Deliberately narrow. */
export const ACCEPTED_INPUT = ["image/jpeg", "image/png"] as const;
export const ACCEPT_ATTRIBUTE = "image/jpeg,image/png,.jpg,.jpeg,.png";

export { MAX_UPLOAD_MB, MAX_STORED_MB };

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
      error: `That photo is ${formatMb(file.size)} — the limit is ${MAX_UPLOAD_MB} MB. Try a smaller version.`,
    };
  }

  let prepared: File;
  try {
    prepared = await compress(file, maxEdgeFor(slot));
  } catch {
    return { error: "Couldn't process that photo. Try a different one." };
  }

  if (prepared.size > MAX_STORED_BYTES) {
    return {
      error: `That photo is still ${formatMb(prepared.size)} after compression — the limit is ${MAX_STORED_MB} MB. Try a smaller or less detailed image.`,
    };
  }

  try {
    const body = new FormData();
    body.append("file", prepared);
    body.append("slot", slot);
    body.append("originalType", file.type);

    const res = await fetch("/api/admin/upload", { method: "POST", body });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) return { error: json.error ?? "Upload failed. Try again." };
    return { url: json.url, key: json.key };
  } catch {
    return { error: "Upload failed — check your connection and try again." };
  }
}

export function compress(file: File, maxEdge = 2560): Promise<File> {
  return imageCompression(file, {
    maxSizeMB: MAX_STORED_MB,
    maxWidthOrHeight: maxEdge,
    useWebWorker: true,
    fileType: "image/webp",
  });
}
