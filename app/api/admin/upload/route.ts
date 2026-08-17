import { NextResponse } from "next/server";

import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "trip-media";
/** Must stay in step with MAX_UPLOAD_MB in lib/uploadImage.ts. */
const MAX_BYTES = 10 * 1024 * 1024;
/** What a person is allowed to pick. */
const ALLOWED_INPUT = new Set(["image/jpeg", "image/png"]);
/** What may land in storage — WebP because we convert before uploading. */
const ALLOWED_STORED = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Uploads a trip photo.
 *
 * The service-role key can write anywhere in storage, so this route is the
 * only place it's used for uploads and the admin check comes first. Note
 * this returns a JSON error rather than redirecting — requireAdmin()'s
 * redirect would surface to fetch() as an opaque HTML response.
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

  // Two checks, because the browser converts to WebP before uploading and
  // the server would otherwise have no idea what was actually picked.
  // Client-side validation is a convenience; this is the enforcement.
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

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 10 MB.` },
      { status: 413 },
    );
  }

  const slot = String(form.get("slot") ?? "photo").replace(/[^a-z0-9-]/gi, "") || "photo";
  const ext = file.type === "image/png" ? "png"
    : file.type === "image/webp" ? "webp"
    : "jpg";

  // Random path per upload: replacing a photo never overwrites the old
  // object, so a cached CDN copy can't serve the wrong image, and the
  // previous version stays recoverable.
  const path = `trips/${slot}-${crypto.randomUUID()}.${ext}`;

  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false, cacheControl: "31536000" });

  if (error) {
    return NextResponse.json({ error: `Upload failed: ${error.message}` }, { status: 500 });
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return NextResponse.json({ url: data.publicUrl, path });
}
