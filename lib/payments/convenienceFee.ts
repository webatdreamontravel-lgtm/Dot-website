import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * The convenience-fee rate, editable without a deploy.
 *
 * Lives in site_settings rather than in code or on the trip, for two reasons.
 * A rate change is a commercial decision the founders should be able to make
 * on a Sunday, and it belongs to the payment rail — putting it on the trip
 * form would invite it being set differently across two batches of the same
 * trip, or forgotten entirely on a new one.
 */

export const CONVENIENCE_FEE_KEY = "convenience_fee";

/** The fallback when the row is missing: charge nothing. */
const OFF = { enabled: false, rateBp: 0, label: "Convenience fee" } as const;

export type ConvenienceFeeConfig = {
  enabled: boolean;
  /** Basis points. 236 = 2.36%. */
  rateBp: number;
  label: string;
};

/**
 * Reads the rate. Never throws.
 *
 * A malformed or missing setting disables the fee rather than guessing at
 * one. Charging a customer a number we aren't sure about is worse than not
 * charging it — the shortfall is ours to notice, and an unexplained line on
 * someone's card statement is not.
 */
export async function getConvenienceFeeConfig(): Promise<ConvenienceFeeConfig> {
  try {
    const row = await prisma.siteSetting.findUnique({
      where: { key: CONVENIENCE_FEE_KEY },
      select: { value: true },
    });
    if (!row?.value || typeof row.value !== "object" || Array.isArray(row.value)) return { ...OFF };

    const v = row.value as Record<string, unknown>;
    const rateBp = typeof v.rateBp === "number" && Number.isFinite(v.rateBp) ? Math.trunc(v.rateBp) : 0;

    return {
      enabled: v.enabled === true && rateBp > 0,
      rateBp: rateBp > 0 ? rateBp : 0,
      label: typeof v.label === "string" && v.label.trim() ? v.label.trim() : OFF.label,
    };
  } catch {
    return { ...OFF };
  }
}

/** The rate to charge right now — 0 when the fee is switched off. */
export async function currentFeeRateBp(): Promise<number> {
  const cfg = await getConvenienceFeeConfig();
  return cfg.enabled ? cfg.rateBp : 0;
}
