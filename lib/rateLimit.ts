import "server-only";

import { headers } from "next/headers";

import { prisma } from "@/lib/prisma";


// ── Configuration ────────────────────────────────────────────────────────────

/**
 * Reads a positive integer from the environment, falling back when absent or
 * nonsense. Clamped rather than trusted: an empty string or a stray `0` would
 * otherwise mean "allow nothing" and lock every visitor out.
 */
function envInt(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

/** Master switch, for turning the whole thing off without a deploy. */
export function rateLimitEnabled(): boolean {
  return process.env.RATE_LIMIT_ENABLED?.trim().toLowerCase() !== "false";
}

/**
 * The buckets. `limit` requests per `windowSec`, per identifier.
 *
 * Defaults are deliberately generous — a limit that trips for a real person
 * retrying a login is worse than one that lets an attacker send a few extra
 * requests, because the first is invisible to you and the second is not.
 */
export const LIMITS = {
  /** Per email address. The one that actually protects the mail spend. */
  emailSend: () => ({
    limit: envInt("RATE_LIMIT_EMAIL_PER_ADDRESS", 5),
    windowSec: envInt("RATE_LIMIT_EMAIL_PER_ADDRESS_WINDOW", 3600),
  }),
  /** Per IP, across all addresses — stops one client spraying many addresses. */
  emailSendIp: () => ({
    limit: envInt("RATE_LIMIT_EMAIL_PER_IP", 20),
    windowSec: envInt("RATE_LIMIT_EMAIL_PER_IP_WINDOW", 3600),
  }),
  /** Password and OTP attempts. */
  authAttempt: () => ({
    limit: envInt("RATE_LIMIT_AUTH_ATTEMPTS", 10),
    windowSec: envInt("RATE_LIMIT_AUTH_WINDOW", 900),
  }),
  /** The "does this address have an account" probe. */
  emailProbe: () => ({
    limit: envInt("RATE_LIMIT_PROBE", 30),
    windowSec: envInt("RATE_LIMIT_PROBE_WINDOW", 60),
  }),
} as const;

/** How long spent windows are kept before the cleanup route removes them. */
export function retentionDays(): number {
  return envInt("RATE_LIMIT_RETENTION_DAYS", 2);
}

// ── Client address ───────────────────────────────────────────────────────────

/**
 * The caller's IP, or null when there isn't a trustworthy one.
 */
export async function clientIp(): Promise<string | null> {
  try {
    const h = await headers();
    const chain = (h.get("x-forwarded-for") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (chain.length > 0) return chain[chain.length - 1];

    // Some proxies set only this one, and it carries a single address.
    const real = h.get("x-real-ip")?.trim();
    return real || null;
  } catch {
    return null;
  }
}

// ── The limiter ──────────────────────────────────────────────────────────────

export type Verdict =
  | { ok: true }
  | { ok: false; retryAfterSec: number; limit: number };

/**
 * Counts one request against a bucket.
 *
 * FAILS OPEN. If the database is unreachable the request is allowed: a blip in
 * the limiter must never be the reason nobody can sign in. The thing being
 * protected here is cost, not correctness, and the trade runs that way.
 */
export async function consume(
  bucket: string,
  identifier: string,
  limit: number,
  windowSec: number,
): Promise<Verdict> {
  if (!rateLimitEnabled() || !identifier) return { ok: true };

  try {
    // Window start is computed in SQL so it can't drift with the app server's
    // clock, and so the whole thing stays one round trip.
    const rows = await prisma.$queryRaw<{ count: number; window_start: Date }[]>`
      INSERT INTO rate_limit (bucket, identifier, window_start, count)
      VALUES (
        ${bucket},
        ${identifier},
        to_timestamp(floor(extract(epoch FROM now()) / ${windowSec}) * ${windowSec}),
        1
      )
      ON CONFLICT (bucket, identifier, window_start)
      DO UPDATE SET count = rate_limit.count + 1
      RETURNING count, window_start`;

    const row = rows[0];
    if (!row) return { ok: true };

    if (row.count > limit) {
      const endsAt = row.window_start.getTime() + windowSec * 1000;
      const retryAfterSec = Math.max(1, Math.ceil((endsAt - Date.now()) / 1000));
      return { ok: false, retryAfterSec, limit };
    }

    return { ok: true };
  } catch (e) {
    console.error(`[rateLimit] ${bucket} check failed, allowing request:`, e);
    return { ok: true };
  }
}

/**
 * Applies the per-address and per-IP email buckets together.
 *
 * Both are counted even when the first refuses, so a caller cannot dodge the
 * IP bucket by burning one address's allowance first.
 */
export async function consumeEmailSend(email: string): Promise<Verdict> {
  const ip = await clientIp();
  const perAddress = LIMITS.emailSend();
  const perIp = LIMITS.emailSendIp();

  const [byAddress, byIp] = await Promise.all([
    consume("email:send", email, perAddress.limit, perAddress.windowSec),
    // No trustworthy IP means no per-IP bucket — see clientIp().
    ip ? consume("email:send:ip", ip, perIp.limit, perIp.windowSec) : Promise.resolve({ ok: true } as Verdict),
  ]);

  return byAddress.ok ? byIp : byAddress;
}

/** Password and OTP attempts, keyed on the address and the IP together. */
export async function consumeAuthAttempt(email: string): Promise<Verdict> {
  const ip = await clientIp();
  const { limit, windowSec } = LIMITS.authAttempt();
  return consume("auth:attempt", ip ? `${email}|${ip}` : email, limit, windowSec);
}

/**
 * Human-readable wait, for the message shown to the person who hit the limit.
 * Rounds up, so "1 minute" never means "try again in 59 seconds and fail".
 */
export function describeWait(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const mins = Math.ceil(seconds / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"}`;
  const hours = Math.ceil(mins / 60);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

/** The message every action shows. One wording, one place to change it. */
export function tooManyRequests(verdict: Extract<Verdict, { ok: false }>): string {
  return `Too many attempts. Try again in ${describeWait(verdict.retryAfterSec)}.`;
}
