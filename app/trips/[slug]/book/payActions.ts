"use server";

import { getSessionProfile } from "@/lib/auth";
import {
  createPaymentOrder,
  type OrderResult,
  type PayMode,
  type TravellerInput,
} from "@/lib/payments/createOrder";
import { paymentsConfigured } from "@/lib/payments/client";

/**
 * Server action wrapper around createPaymentOrder.
 *
 * Thin on purpose: the session check and the "are keys even configured"
 * check belong at the boundary, and everything about seats, pricing and
 * orders belongs in lib/payments where it can be tested without a request.
 */
export async function startPayment(input: {
  slug: string;
  seats: number;
  payMode?: PayMode;
  travellers: TravellerInput[];
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  notes?: string;
}): Promise<OrderResult & { keyId?: string }> {
  const profile = await getSessionProfile();
  if (!profile) {
    return { ok: false, error: "Your session expired. Sign in again to finish." };
  }

  if (!paymentsConfigured()) {
    return {
      ok: false,
      error: "Online payment isn't switched on yet. Book your seat and we'll call you.",
      code: "NOT_ENABLED",
    };
  }

  const result = await createPaymentOrder({
    ...input,
    profileId: profile.id,
    travellers: input.travellers.map((t) => ({
      fullName: t.fullName.trim(),
      phone: t.phone.trim(),
      email: t.email.trim(),
      gender: t.gender,
    })),
  });

  if (!result.ok) return result;

  // The publishable key. Safe in the browser — it identifies the merchant and
  // can't authorise anything on its own.
  return { ...result, keyId: process.env.RAZORPAY_KEY_ID! };
}
