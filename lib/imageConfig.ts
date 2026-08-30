/**
 * Image size limits, shared by the browser and the upload route.
 *
 * These used to be two hardcoded constants — MAX_UPLOAD_MB here and MAX_BYTES
 * in the route — kept in step by a comment. They are one source now, so they
 * cannot drift.
 *
 * Both are NEXT_PUBLIC because the browser needs them: it refuses an oversized
 * pick before uploading, tells the person what the limit is, and compresses
 * towards the stored target. That also means **changing either value requires
 * a rebuild** — the bundler inlines NEXT_PUBLIC_* at build time, so a PM2
 * restart alone will not pick up a new number.
 */

/**
 * Reads a positive number from the environment, falling back when it is
 * absent or nonsense.
 *
 * Clamped rather than trusted: an empty string, a typo, or a stray `0` in
 * .env would otherwise disable the limit entirely and let anything through.
 */
function readMb(raw: string | undefined, fallback: number, max: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

/**
 * Largest file a person may choose, measured on the ORIGINAL before any
 * resizing. Checked in the browser so an oversized photo is refused instantly
 * instead of after a long upload, and again on the server, which is the part
 * that actually enforces it.
 */
export const MAX_UPLOAD_MB = readMb(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB, 10, 50);

/**
 * Ceiling for what may land in storage. The browser compresses until it is
 * under this; the server rejects anything that still is not.
 *
 * Kept below MAX_UPLOAD_MB on purpose — the whole point is that a 10 MB phone
 * photo becomes a few hundred KB before it costs us storage and bandwidth.
 */
export const MAX_STORED_MB = Math.min(
  readMb(process.env.NEXT_PUBLIC_MAX_STORED_MB, 5, 50),
  MAX_UPLOAD_MB,
);

export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
export const MAX_STORED_BYTES = MAX_STORED_MB * 1024 * 1024;

/** For error messages: "4.2 MB". */
export function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
