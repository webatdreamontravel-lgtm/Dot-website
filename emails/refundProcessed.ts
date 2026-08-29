import { siteConfig } from "@/lib/data/siteConfig";
import { CREAM, escapeHtml, layout, MUTED, NAVY } from "./layout";

/**
 * Sent when money has actually left our account — not when it was asked for.
 *
 * The distinction matters. Razorpay confirms refunds asynchronously and one
 * can sit pending for days over a weekend, so an email on the *request*
 * would tell someone their money was back while it was still with us. This
 * fires from the refund.processed webhook, which is the first moment the
 * statement "your refund is on its way" is true.
 *
 * It quotes 5–7 working days because that is what Razorpay quotes and what
 * the bank actually controls. Naming an exact date would be inventing a
 * precision nobody has: after `processed` the money is with the card network
 * and no event — for us or for Razorpay — says when it lands.
 */
export function refundProcessedEmail({
  name,
  reference,
  tripTitle,
  amountPaise,
  refundedTotalPaise,
  paidPaise,
}: {
  name: string;
  reference: string;
  tripTitle: string;
  /** This refund. */
  amountPaise: number;
  /** Everything refunded on the booking, including this one. */
  refundedTotalPaise: number;
  /** Everything they paid. */
  paidPaise: number;
}) {
  const rupees = (p: number) =>
    "₹" + (p / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });

  const full = refundedTotalPaise >= paidPaise;
  const partial = !full && refundedTotalPaise > amountPaise;

  const row = (label: string, value: string, strong = false) =>
    `<tr>
       <td style="padding:7px 0;color:${MUTED};font-size:14px;">${escapeHtml(label)}</td>
       <td style="padding:7px 0;text-align:right;font-size:14px;color:${NAVY};${
         strong ? "font-weight:700;" : ""
       }">${escapeHtml(value)}</td>
     </tr>`;

  const body = `
    <p style="margin:0 0 14px;">Hi ${escapeHtml(name)} — we've sent
      <strong style="color:${NAVY};">${rupees(amountPaise)}</strong> back to the account you
      paid from, for <strong style="color:${NAVY};">${escapeHtml(tripTitle)}</strong>.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="margin:18px 0;padding:16px 18px;background:${CREAM};border-radius:12px;">
      ${row("Booking reference", reference, true)}
      ${row("Refunded now", rupees(amountPaise), true)}
      ${partial ? row("Refunded in total", rupees(refundedTotalPaise)) : ""}
      ${row("You paid", rupees(paidPaise))}
      ${full ? row("Still with us", "Nothing") : ""}
    </table>

    <p style="margin:0 0 14px;">Banks usually take <strong style="color:${NAVY};">5 to 7 working
      days</strong> to show it. It will appear on the same card or account the payment came
      from — there's nothing you need to do.</p>

    <p style="margin:0;font-size:13px;color:${MUTED};">If it hasn't arrived after seven working
      days, reply to this email quoting
      <strong style="color:${NAVY};">${escapeHtml(reference)}</strong> and we'll chase it with
      the bank.</p>`;

  return {
    subject: `Refund sent — ${rupees(amountPaise)} for ${reference}`,
    html: layout({
      heading: `${rupees(amountPaise)} is on its way back.`,
      body,
      preheader: `${reference} · 5–7 working days to reach your account`,
    }),
    text:
      `Hi ${name}, we've sent ${rupees(amountPaise)} back to the account you paid from, ` +
      `for ${tripTitle}.\n\n` +
      `Booking reference: ${reference}\n` +
      `Refunded now: ${rupees(amountPaise)}\n` +
      (partial ? `Refunded in total: ${rupees(refundedTotalPaise)}\n` : "") +
      `You paid: ${rupees(paidPaise)}\n` +
      (full ? `Still with us: nothing\n` : "") +
      `\nBanks usually take 5 to 7 working days to show it. It will appear on the same card ` +
      `or account the payment came from — nothing for you to do.\n\n` +
      `If it hasn't arrived after seven working days, reply quoting ${reference} and we'll ` +
      `chase it with the bank.\n\n${siteConfig.url}/account\n`,
  };
}
