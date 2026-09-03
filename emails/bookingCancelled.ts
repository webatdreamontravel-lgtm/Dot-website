import { siteConfig } from "@/lib/data/siteConfig";
import { button, CREAM, escapeHtml, layout, MUTED, NAVY } from "./layout";

/**
 * Confirms a booking has been cancelled.
 *
 * Sent when the team cancels from the admin panel — which is also the moment
 * the seat goes back to the trip, so this is the customer's only signal that
 * it happened. Silence here is how someone turns up at the pickup point.
 *
 * ── On money it states facts and promises nothing ──
 *
 * It shows what was paid and what has already come back, and stops. It does
 * not name what is still held, does not say when the rest is coming, and does
 * NOT quote a refund percentage — because the published
 * cancellation policy and how DOT actually settles these are not currently
 * the same thing — the policy page offers 90/50/25% by notice period, while
 * the practice is credit against a future trip. An email that picked one
 * would be quoted back at the team by whichever customer it suited.
 *
 * Once that is reconciled, this is the right place to state it plainly, and
 * the amount is already to hand.
 *
 * The reason is included only when the admin typed one. An empty "Reason:"
 * line reads as evasive, and a generic one invented here would be worse.
 */
export function bookingCancelledEmail({
  name,
  reference,
  tripTitle,
  startDate,
  seats,
  paidPaise,
  refundedPaise = 0,
  reason,
}: {
  name: string;
  reference: string;
  tripTitle: string;
  startDate: Date;
  seats: number;
  /** What they have paid so far. Zero for a booking that never paid. */
  paidPaise: number;
  /** What has already gone back, by any route. */
  refundedPaise?: number;
  reason?: string | null;
}) {
  const rupees = (p: number) =>
    "₹" + (p / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  const day = startDate.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  /**
   * What is actually still with us, not what was paid.
   *
   * This used to promise "we'll be in touch about the ₹4,200 you've paid" on
   * a booking where ₹2,500 had already gone back — which reads as though none
   * of it had, and invites a reply asking where their money is.
   */
  const heldPaise = Math.max(paidPaise - refundedPaise, 0);

  const row = (label: string, value: string, strong = false) =>
    `<tr>
       <td style="padding:7px 0;color:${MUTED};font-size:14px;">${escapeHtml(label)}</td>
       <td style="padding:7px 0;text-align:right;font-size:14px;color:${NAVY};${
         strong ? "font-weight:700;" : ""
       }">${escapeHtml(value)}</td>
     </tr>`;

  const body = `
    <p style="margin:0 0 14px;">Hi ${escapeHtml(name)} — your booking for
      <strong style="color:${NAVY};">${escapeHtml(tripTitle)}</strong> on ${escapeHtml(day)}
      has been cancelled. ${seats === 1 ? "The seat is" : `All ${seats} seats are`} released.</p>

    ${
      reason
        ? `<p style="margin:0 0 14px;color:${MUTED};font-size:14px;">Reason given:
             <span style="color:${NAVY};">${escapeHtml(reason)}</span></p>`
        : ""
    }

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="margin:18px 0;padding:16px 18px;background:${CREAM};border-radius:12px;">
      ${row("Booking reference", reference, true)}
      ${row("Trip", tripTitle)}
      ${row("Departure", day)}
      ${paidPaise > 0 ? row("Paid so far", rupees(paidPaise)) : ""}
      ${refundedPaise > 0 ? row("Refunded to you", `− ${rupees(refundedPaise)}`) : ""}
    </table>

    ${
      paidPaise === 0
        ? `<p style="margin:0 0 14px;">Nothing was charged, so there's nothing to settle.</p>`
        : heldPaise === 0
          ? `<p style="margin:0 0 14px;">Everything you paid has been returned to you — there's
             nothing left outstanding on this booking.</p>`
          : refundedPaise > 0
            ? // Partly refunded: the two figures above say it. Naming what is
              // left invites "when do I get the rest?", and the answer is a
              // judgement the team makes per customer — not something an
              // automated email should commit them to.
              ""
            : `<p style="margin:0 0 14px;">You've paid <strong style="color:${NAVY};">${rupees(
                paidPaise,
              )}</strong> towards this trip. One of us will be in touch within one working day
               about what happens to it — you don't need to do anything in the meantime.</p>`
    }

    <p style="margin:0 0 14px;">If this wasn't what you expected, reply to this email and
      we'll look into it straight away.</p>

    ${button(`${siteConfig.url}/trips`, "See other trips")}`;

  return {
    subject: `Cancelled — ${tripTitle} (${reference})`,
    html: layout({
      heading: "Your booking has been cancelled.",
      body,
      preheader:
        paidPaise === 0
          ? `${reference} · nothing was charged`
          : heldPaise === 0
            ? `${reference} · everything you paid has been returned`
            : refundedPaise > 0
              ? `${reference} · ${rupees(refundedPaise)} refunded so far`
              : `${reference} · we'll be in touch about the ${rupees(paidPaise)} you've paid`,
    }),
    text:
      `Hi ${name}, your booking for ${tripTitle} on ${day} has been cancelled. ` +
      `${seats === 1 ? "The seat is" : `All ${seats} seats are`} released.\n\n` +
      (reason ? `Reason given: ${reason}\n\n` : "") +
      `Booking reference: ${reference}\n` +
      (paidPaise > 0 ? `Paid so far: ${rupees(paidPaise)}\n` : "") +
      (refundedPaise > 0 ? `Refunded to you: ${rupees(refundedPaise)}\n` : "") +
      "\n" +
      (paidPaise === 0
        ? `Nothing was charged, so there's nothing to settle.\n`
        : heldPaise === 0
          ? `Everything you paid has been returned to you — nothing is left outstanding.\n`
          : refundedPaise > 0
            ? ""
            : `One of us will be in touch within one working day about what happens to it. ` +
              `You don't need to do anything in the meantime.\n`) +
      `\nIf this wasn't what you expected, just reply and we'll look into it.\n\n` +
      `Other trips: ${siteConfig.url}/trips\n`,
  };
}
