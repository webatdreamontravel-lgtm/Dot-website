import { NextResponse } from "next/server";

import { getSessionProfile } from "@/lib/auth";
import {
  formatMb,
  MAX_STORED_BYTES,
  MAX_STORED_MB,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_MB,
} from "@/lib/imageConfig";
import { buildKey, publicUrlFor, putImage } from "@/lib/s3";

/** What a person is allowed to pick. */
const ALLOWED_INPUT = new Set(["image/jpeg", "image/png"]);
/** What may land in storage — WebP because we convert before uploading. */
const ALLOWED_STORED = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Uploads a trip photo to S3.
 *
 * These credentials can write and delete, so this route is the only place
 * they're used for uploads and the admin check comes first. Note this returns
 * a JSON error rather than redirecting — requireAdmin()'s redirect would
 * surface to fetch() as an opaque HTML response.
 */
export async function POST(request: Request) {
  const profile = await getSessionProfile();
  if (!profile || profile.role !== "ADMIN") {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Couldn't read the upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was attached." }, { status: 400 });
  }

  const originalType = String(form.get("originalType") ?? "");
  if (originalType && !ALLOWED_INPUT.has(originalType)) {
    return NextResponse.json(
      { error: "Only JPG and PNG photos can be uploaded." },
      { status: 415 },
    );
  }

  // Trust the bytes, not the filename — the extension is caller-controlled.
  if (!ALLOWED_STORED.has(file.type)) {
    return NextResponse.json(
      { error: "That file isn't a supported image." },
      { status: 415 },
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `That image is ${formatMb(file.size)}. The limit is ${MAX_UPLOAD_MB} MB.` },
      { status: 413 },
    );
  }

  if (file.size > MAX_STORED_BYTES) {
    return NextResponse.json(
      {
        error: `That image is ${formatMb(file.size)} after compression. The limit is ${MAX_STORED_MB} MB.`,
      },
      { status: 413 },
    );
  }

  const slot = String(form.get("slot") ?? "photo").replace(/[^a-z0-9-]/gi, "") || "photo";
  const ext = file.type === "image/png" ? "png"
    : file.type === "image/webp" ? "webp"
    : "jpg";

  const key = buildKey(slot, ext);

  try {
    await putImage(key, new Uint8Array(await file.arrayBuffer()), file.type);
  } catch (e) {
    return NextResponse.json(
      { error: `Upload failed: ${(e as Error).message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: publicUrlFor(key), key });
}
