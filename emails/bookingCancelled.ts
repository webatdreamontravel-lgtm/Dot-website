import { siteConfig } from "@/lib/data/siteConfig";
import { button, CREAM, escapeHtml, layout, MUTED, NAVY } from "./layout";

/**
 * Confirms a booking has been cancelled.
 *
 * Sent when the team cancels from the admin panel — which is also the moment
 * the seat goes back to the trip, so this is the customer's only signal that
 * it happened. Silence here is how someone turns up at the pickup point.
 *
 * ── On money, this email deliberately promises nothing ──
 *
 * If anything was paid it says the team will be in touch about it, and
 * stops. It does NOT quote a refund percentage, because the published
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
  reason,
}: {
  name: string;
  reference: string;
  tripTitle: string;
  startDate: Date;
  seats: number;
  /** What they have paid so far. Zero for a booking that never paid. */
  paidPaise: number;
  reason?: string | null;
}) {
  const rupees = (p: number) =>
    "₹" + (p / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  const day = startDate.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

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
      ${paidPaise > 0 ? row("Paid so far", rupees(paidPaise), true) : ""}
    </table>

    ${
      paidPaise > 0
        ? `<p style="margin:0 0 14px;">You've paid <strong style="color:${NAVY};">${rupees(
            paidPaise,
          )}</strong> towards this trip. One of us will be in touch within one working day
           about what happens to it — you don't need to do anything in the meantime.</p>`
        : `<p style="margin:0 0 14px;">Nothing was charged, so there's nothing to settle.</p>`
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
        paidPaise > 0
          ? `${reference} · we'll be in touch about the ${rupees(paidPaise)} you've paid`
          : `${reference} · nothing was charged`,
    }),
    text:
      `Hi ${name}, your booking for ${tripTitle} on ${day} has been cancelled. ` +
      `${seats === 1 ? "The seat is" : `All ${seats} seats are`} released.\n\n` +
      (reason ? `Reason given: ${reason}\n\n` : "") +
      `Booking reference: ${reference}\n` +
      (paidPaise > 0
        ? `Paid so far: ${rupees(paidPaise)}\n\n` +
          `One of us will be in touch within one working day about what happens to it. ` +
          `You don't need to do anything in the meantime.\n`
        : `Nothing was charged, so there's nothing to settle.\n`) +
      `\nIf this wasn't what you expected, just reply and we'll look into it.\n\n` +
      `Other trips: ${siteConfig.url}/trips\n`,
  };
}
