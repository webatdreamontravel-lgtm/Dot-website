"use client";

import { useEffect } from "react";
import clarity from "@microsoft/clarity";

/**
 * Microsoft Clarity — session recordings and heatmaps.
 *
 * A client component with an effect rather than a <Script> tag, because the
 * package initialises itself through a function call. `Clarity.init` touches
 * `document` immediately, so it cannot run during render or on the server.
 *
 * Presence of the environment variable is the on/off switch, deliberately.
 * Set NEXT_PUBLIC_CLARITY_PROJECT_ID in the production environment and leave
 * it unset locally, and development records nothing — no NODE_ENV check
 * needed, and no way for a stray localhost session to end up in the
 * recordings. It also means you *can* switch it on locally for a few minutes
 * to check the integration, which a hardcoded environment check would forbid.
 *
 * (This is why it differs from Analytics.tsx: GA carries a default measurement
 * ID, so that one needs an explicit development guard. Clarity has no default,
 * so the variable alone decides.)
 */
const PROJECT_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;

export function ClarityAnalytics() {
  useEffect(() => {
    if (!PROJECT_ID) return;

    // Never let an analytics failure surface to a customer. A blocked script,
    // an ad blocker, or a bad project id must not take the page down.
    try {
      clarity.init(PROJECT_ID);
    } catch (e) {
      console.warn("[clarity] init failed", e);
    }
  }, []);

  return null;
}
