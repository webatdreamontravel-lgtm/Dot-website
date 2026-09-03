import "server-only";

import Razorpay from "razorpay";

/**
 * The Razorpay API client.
 *
 * Built lazily rather than at module load. A missing key is a deployment
 * mistake, and throwing at import time would take down every page that
 * transitively imports this — including pages that never take a payment.
 * Failing at the point of use keeps the blast radius to checkout, where the
 * error is also legible: "payments aren't configured" rather than a blank 500
 * on the home page.
 *
 * Keys are read from the environment on each call so a rotation takes effect
 * without a rebuild.
 */

export class PaymentsNotConfiguredError extends Error {
  constructor(missing: string[]) {
    super(
      `Razorpay is not configured — missing ${missing.join(", ")}. ` +
        `Set them in .env.local (or the Vercel project) and restart.`,
    );
    this.name = "PaymentsNotConfiguredError";
  }
}

function requireEnv(names: string[]): string[] {
  const missing = names.filter((n) => !process.env[n]?.trim());
  if (missing.length) throw new PaymentsNotConfiguredError(missing);
  return names.map((n) => process.env[n]!.trim());
}

/** True when the server holds enough credentials to talk to Razorpay. */
export function paymentsConfigured(): boolean {
  return Boolean(
    process.env.RAZORPAY_KEY_ID?.trim() && process.env.RAZORPAY_KEY_SECRET?.trim(),
  );
}

let cached: { key: string; client: Razorpay } | null = null;

export function razorpay(): Razorpay {
  const [key_id, key_secret] = requireEnv(["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"]);

  // Re-use the instance unless the key itself changed. The SDK holds an HTTP
  // agent; making a new one per request would leak sockets under load.
  if (cached?.key === key_id) return cached.client;

  cached = { key: key_id, client: new Razorpay({ key_id, key_secret }) };
  return cached.client;
}

/** The secret webhook deliveries are signed with. Separate from the API key. */
export function webhookSecret(): string {
  const [secret] = requireEnv(["RAZORPAY_WEBHOOK_SECRET"]);
  return secret;
}

/** The API secret, used to verify the browser checkout callback signature. */
export function apiSecret(): string {
  const [secret] = requireEnv(["RAZORPAY_KEY_SECRET"]);
  return secret;
}

/**
 * Test keys are prefixed `rzp_test_`. Surfaced so the admin can show which
 * mode a payment was taken in — a live booking against test keys is money
 * that never arrives, and it should be obvious on screen, not a surprise at
 * reconciliation.
 */
export function isTestMode(): boolean {
  return (process.env.RAZORPAY_KEY_ID ?? "").startsWith("rzp_test_");
}
