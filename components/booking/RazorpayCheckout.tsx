"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Opens Razorpay's hosted checkout.
 *
 * The script is loaded on demand rather than in the page head — it's ~100KB
 * that only matters to someone who has reached the last step of a booking
 * form, and most visitors never will. It is warmed on mount so the click
 * that opens checkout isn't also the click that starts a network fetch.
 */

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

let scriptPromise: Promise<void> | null = null;

/** Loads checkout.js once, however many times this is called. */
function loadCheckout(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Razorpay) return Promise.resolve();

  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("checkout script failed")));
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      // Let a later attempt retry rather than caching the failure forever.
      scriptPromise = null;
      reject(new Error("checkout script failed"));
    };
    document.body.appendChild(s);
  });

  return scriptPromise;
}

export type CheckoutHandoff = {
  keyId: string;
  orderId: string;
  amountPaise: number;
  currency: string;
  reference: string;
  tripTitle: string;
  customer: { name: string | null; email: string; phone: string | null };
};

export type CheckoutCallbacks = {
  onSuccess: (r: { orderId: string; paymentId: string; signature: string }) => void;
  onDismiss: () => void;
  onError: (message: string) => void;
};

export function useRazorpayCheckout() {
  const [busy, setBusy] = useState(false);
  const openRef = useRef(false);

  useEffect(() => {
    void loadCheckout().catch(() => {});
  }, []);

  const open = useCallback(async (handoff: CheckoutHandoff, callbacks: CheckoutCallbacks) => {
    // A double click must not open two checkouts against one order.
    if (openRef.current) return;
    openRef.current = true;
    setBusy(true);

    const release = () => {
      openRef.current = false;
      setBusy(false);
    };

    try {
      await loadCheckout();
    } catch {
      release();
      callbacks.onError("Couldn't reach the payment window. Check your connection and try again.");
      return;
    }

    if (!window.Razorpay) {
      release();
      callbacks.onError("The payment window didn't load. Please try again.");
      return;
    }

    const rzp = new window.Razorpay({
      key: handoff.keyId,
      order_id: handoff.orderId,
      amount: handoff.amountPaise,
      currency: handoff.currency,
      name: "Dream On Travel",
      description: handoff.tripTitle,
      // Shown on Razorpay's own receipt, so support can match it to ours.
      notes: { reference: handoff.reference },
      prefill: {
        name: handoff.customer.name ?? "",
        email: handoff.customer.email,
        contact: handoff.customer.phone ?? "",
      },
      theme: { color: "#0f1e3d" },
      handler: (r: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => {
        release();
        callbacks.onSuccess({
          orderId: r.razorpay_order_id,
          paymentId: r.razorpay_payment_id,
          signature: r.razorpay_signature,
        });
      },
      modal: {
        ondismiss: () => {
          release();
          callbacks.onDismiss();
        },
      },
    });

    rzp.open();
  }, []);

  return { open, busy };
}
