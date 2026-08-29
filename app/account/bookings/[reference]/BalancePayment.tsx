"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";

import { useRazorpayCheckout } from "@/components/booking/RazorpayCheckout";
import { formatINR } from "@/lib/utils";
import { toRupees } from "@/lib/booking/pricing";
import { startBalancePayment } from "./balanceActions";

/**
 * Settling what's left after the advance.
 *
 * Deliberately the same checkout the first payment used, against a new order
 * for the balance only — so a customer who paid an advance in August and the
 * rest in October sees one familiar flow twice, and both payments land on the
 * same booking rather than creating a second one.
 */
export function BalancePayment({
  reference,
  balancePaise,
  customer,
  tripTitle,
  compact,
}: {
  reference: string;
  balancePaise: number;
  customer: { name: string | null; email: string; phone: string | null };
  tripTitle: string;
  /**
   * Inline on a card in the bookings list, rather than the full panel on the
   * booking's own page. The card already states the balance above it, so
   * repeating it in a box would say the same number twice.
   */
  compact?: boolean;
}) {
  const router = useRouter();
  const checkout = useRazorpayCheckout();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async () => {
    setError(null);
    setBusy(true);

    const order = await startBalancePayment({ reference });
    if (!order.ok) {
      setError(order.error);
      setBusy(false);
      return;
    }

    await checkout.open(
      {
        keyId: order.keyId,
        orderId: order.orderId,
        amountPaise: order.amountPaise,
        currency: "INR",
        reference,
        tripTitle,
        customer,
      },
      {
        onSuccess: async ({ orderId, paymentId, signature }) => {
          // Same verify route as the first payment. If it fails the webhook
          // still confirms — never leave someone who has just paid stuck.
          await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: orderId,
              razorpay_payment_id: paymentId,
              razorpay_signature: signature,
            }),
          }).catch(() => null);
          setBusy(false);
          router.refresh();
        },
        onDismiss: () => setBusy(false),
        onError: (m) => {
          setError(m);
          setBusy(false);
        },
      },
    );
  };

  if (compact) {
    return (
      // Sits in the card's action row, so it carries no margin or divider of
      // its own — the row owns the spacing between the two buttons.
      <div className="min-w-0 flex-1">
        {error && (
          <p role="alert" className="mb-2 flex items-start gap-1.5 text-[0.82rem] text-coral">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-none" />
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={pay}
          disabled={busy || checkout.busy}
          className="btn btn-primary min-h-[44px] w-full justify-center px-4 text-[0.9rem] disabled:opacity-70"
        >
          {busy || checkout.busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Opening payment…
            </>
          ) : (
            <>Pay {formatINR(toRupees(balancePaise))} now</>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-teal/25 bg-teal/[0.06] p-4">
      <p className="text-[0.9rem] text-navy/75">
        <strong className="text-navy">{formatINR(toRupees(balancePaise))}</strong> left to pay
        before you travel.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-2.5 flex items-start gap-2 text-[0.85rem] leading-relaxed text-coral"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={pay}
        disabled={busy || checkout.busy}
        className="btn btn-primary mt-3 w-full justify-center disabled:opacity-70"
      >
        {busy || checkout.busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Opening payment…
          </>
        ) : (
          <>Pay {formatINR(toRupees(balancePaise))} now</>
        )}
      </button>

      <p className="mt-2.5 text-center text-[0.78rem] text-navy/45">
        Prefer UPI or a bank transfer? Message us and we&apos;ll send the details.
      </p>
    </div>
  );
}
