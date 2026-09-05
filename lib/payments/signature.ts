import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { apiSecret, webhookSecret } from "@/lib/payments/client";

/**
 * HMAC checks for the two things Razorpay signs.
 *
 * Compared in constant time. A plain `===` on a hex digest leaks how many
 * leading characters were right through how long the comparison took, which
 * over enough attempts is enough to forge a signature one nibble at a time.
 * The cost of doing it properly is nil, so there's no reason not to.
 */

function safeEqualHex(a: string, b: string): boolean {
  // timingSafeEqual throws on length mismatch — which would itself leak the
  // length — so normalise to fixed-width buffers first.
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    // Still burn a comparison so the early exit isn't measurably faster.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * Webhook deliveries: HMAC-SHA256 over the RAW request body.
 *
 * "Raw" is load-bearing. JSON.parse followed by JSON.stringify produces
 * different bytes — key order, whitespace, unicode escaping — and the digest
 * would never match. The route must read request.text() and pass that string
 * here untouched.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", webhookSecret()).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}

/**
 * The browser checkout callback: HMAC-SHA256 over "order_id|payment_id",
 * keyed with the API secret rather than the webhook secret.
 *
 * Two different secrets for two different signatures — using the wrong one
 * fails in a way that looks exactly like an attack, so they're separated here
 * rather than passed in by the caller.
 */
export function verifyCheckoutSignature(
  orderId: string,
  paymentId: string,
  signature: string | null,
): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", apiSecret())
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return safeEqualHex(expected, signature);
}
