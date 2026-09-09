/**
 * Client-side upload helper. Shared by the photo slots, the itinerary day
 * photos and the in-editor image button so compression, size limits and
 * error handling behave identically everywhere.
 */

import imageCompression from "browser-image-compression";

import { slotFor } from "@/lib/imageSlots";
import {
  formatMb,
  MAX_STORED_BYTES,
  MAX_STORED_MB,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_MB,
} from "@/lib/imageConfig";

export type UploadResult = { url: string; key: string } | { error: string };

/** What a person is allowed to PICK. Deliberately narrow. */
export const ACCEPTED_INPUT = ["image/jpeg", "image/png"] as const;

/**
 * What may reach the upload, which is a wider set.
 *
 * A photo bound for a fixed-shape slot comes back from the cropper already
 * encoded as WebP at the slot's exact size, so by the time it gets here it
 * is no longer the JPEG or PNG that was picked. The pick list above is what
 * the file input and the picker check against; this is what the network
 * call accepts.
 */
const UPLOADABLE = new Set<string>([...ACCEPTED_INPUT, "image/webp"]);
export const ACCEPT_ATTRIBUTE = "image/jpeg,image/png,.jpg,.jpeg,.png";

export { MAX_UPLOAD_MB, MAX_STORED_MB };

/** Only for slots with no fixed shape — rich-text images, in practice. */
const FREEFORM_MAX_EDGE = 1800;

/**
 * The longest edge to compress towards.
 *
 * A shaped slot answers this itself: the cropper has already produced
 * exactly slot.width x slot.height, so the cap is the slot's own long edge
 * and compression only re-encodes rather than resizing again. Everything
 * else falls back to one number.
 */
function maxEdgeFor(target: string): number {
  const slot = slotFor(target);
  return slot ? Math.max(slot.width, slot.height) : FREEFORM_MAX_EDGE;
}

export async function uploadImage(file: File, slot: string): Promise<UploadResult> {
  if (!UPLOADABLE.has(file.type)) {
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
