import "server-only";

import {
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

/**
 * S3 access for trip media.
 *
 * The `server-only` import above makes the build FAIL if this module is ever
 * pulled into a client component — the same guard lib/supabase/admin.ts uses,
 * and for the same reason: these credentials can write and delete.
 *
 * Credentials are NOT passed explicitly. The SDK's default chain reads
 * AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY from the environment, which means
 * the exact same code works unchanged if you later attach an IAM role to the
 * instance and delete the keys from .env.
 */

const PREFIX = "trips";

function bucket(): string {
  const name = process.env.AWS_S3_BUCKET;
  if (!name) {
    throw new Error("AWS_S3_BUCKET is not set. Copy .env.example and fill it in.");
  }
  return name;
}

function region(): string {
  const value = process.env.AWS_REGION;
  if (!value) {
    throw new Error("AWS_REGION is not set. Copy .env.example and fill it in.");
  }
  return value;
}

/**
 * One client per process. The SDK pools connections internally, so building a
 * fresh client per request would throw that away and re-resolve credentials
 * every time.
 */
let cached: S3Client | undefined;

function client(): S3Client {
  cached ??= new S3Client({ region: region() });
  return cached;
}

/**
 * Public base for stored objects — the bucket's regional endpoint, which is
 * what a public-read bucket serves.
 *
 * If a CDN or custom domain is ever put in front, this is the single place
 * that changes. Note that `keyFromUrl` would then need to recognise BOTH the
 * new host and the S3 one, because URLs already written to the database keep
 * pointing at the old host and must stay deletable.
 */
function publicBase(): string {
  return `https://${bucket()}.s3.${region()}.amazonaws.com`;
}

export function publicUrlFor(key: string): string {
  return `${publicBase()}/${key}`;
}

/** Where an uploaded image lives. Random per upload — see the upload route. */
export function buildKey(slot: string, ext: string): string {
  return `${PREFIX}/${slot}-${crypto.randomUUID()}.${ext}`;
}

/**
 * Recovers the object key from a stored URL, or null if the URL is not ours.
 *
 * This is the guard that makes deletion safe. Trip records also hold Unsplash
 * URLs (seed data) and legacy Supabase Storage URLs from before the move to
 * S3; both must survive a diff untouched. Anything whose origin is not our
 * bucket, or whose path is outside the trips/ prefix, returns null.
 */
export function keyFromUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  let base: URL;
  try {
    base = new URL(publicBase());
  } catch {
    return null;
  }
  if (parsed.origin !== base.origin) return null;

  const path = decodeURIComponent(parsed.pathname).replace(/^\/+/, "");

  // Never let a crafted URL walk outside the prefix we own.
  if (!path.startsWith(`${PREFIX}/`) || path.includes("..")) return null;

  return path;
}

export async function putImage(
  key: string,
  body: Uint8Array,
  contentType: string,
): Promise<void> {
  await client().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
      // Immutable: every upload gets a fresh UUID key, so a stored object is
      // never replaced and can be cached forever.
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
}

/**
 * Deletes objects, in batches of 1000 (the API's hard limit).
 *
 * Returns the keys it could not delete rather than throwing. Callers are
 * cleaning up after a save that has already succeeded — a leftover object is
 * a rounding error on the storage bill, but an exception here would surface
 * as a failed save for a trip that was in fact written correctly.
 */
export async function deleteImages(keys: string[]): Promise<string[]> {
  if (keys.length === 0) return [];

  const failed: string[] = [];

  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000);
    try {
      const result = await client().send(
        new DeleteObjectsCommand({
          Bucket: bucket(),
          Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
        }),
      );
      for (const error of result.Errors ?? []) {
        if (error.Key) failed.push(error.Key);
      }
    } catch {
      failed.push(...batch);
    }
  }

  return failed;
}
