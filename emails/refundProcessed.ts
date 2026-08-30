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
/**
 * How the money went back, in the customer's words, and whether there is a
 * wait attached to it.
 *
 * Only a gateway refund has one. Cash was already handed over; a UPI transfer
 * has usually landed before the email does. Telling someone to expect their
 * own cash in "5 to 7 working days" would be absurd, and is exactly what a
 * single template with a single timing sentence would have said.
 */
const RETURNED_BY: Record<string, { how: string; wait: string | null }> = {
  RAZORPAY: {
    how: "to the account you paid from",
    wait:
      "Banks usually take 5 to 7 working days to show it. It will appear on the same card " +
      "or account the payment came from — there's nothing you need to do.",
  },
  CASH: { how: "to you in cash", wait: null },
  UPI: { how: "to you by UPI", wait: "It should be with you already — UPI transfers are instant." },
  BANK_TRANSFER: {
    how: "to your bank account",
    wait: "Bank transfers usually land within a working day.",
  },
  OTHER: { how: "to you", wait: null },
};

export function refundProcessedEmail({
  name,
  reference,
  tripTitle,
  amountPaise,
  refundedTotalPaise,
  paidPaise,
  method = "RAZORPAY",
  externalReference,
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
  /** RAZORPAY | CASH | UPI | BANK_TRANSFER | OTHER. */
  method?: string;
  /** UTR or receipt number, when the team returned it by hand. */
  externalReference?: string | null;
}) {
  const rupees = (p: number) =>
    "₹" + (p / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });

  const full = refundedTotalPaise >= paidPaise;
  const partial = !full && refundedTotalPaise > amountPaise;
  const returned = RETURNED_BY[method] ?? RETURNED_BY.OTHER;

  const row = (label: string, value: string, strong = false) =>
    `<tr>
       <td style="padding:7px 0;color:${MUTED};font-size:14px;">${escapeHtml(label)}</td>
       <td style="padding:7px 0;text-align:right;font-size:14px;color:${NAVY};${
         strong ? "font-weight:700;" : ""
       }">${escapeHtml(value)}</td>
     </tr>`;

  const body = `
    <p style="margin:0 0 14px;">Hi ${escapeHtml(name)} — we've returned
      <strong style="color:${NAVY};">${rupees(amountPaise)}</strong> ${escapeHtml(returned.how)},
      for <strong style="color:${NAVY};">${escapeHtml(tripTitle)}</strong>.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="margin:18px 0;padding:16px 18px;background:${CREAM};border-radius:12px;">
      ${row("Booking reference", reference, true)}
      ${row("Refunded now", rupees(amountPaise), true)}
      ${externalReference ? row("Reference", externalReference) : ""}
      ${partial ? row("Refunded in total", rupees(refundedTotalPaise)) : ""}
      ${row("You paid", rupees(paidPaise))}
      ${full ? row("Still with us", "Nothing") : ""}
    </table>

    ${returned.wait ? `<p style="margin:0 0 14px;">${escapeHtml(returned.wait)}</p>` : ""}

    <p style="margin:0;font-size:13px;color:${MUTED};">If anything here doesn't match what you
      received, reply to this email quoting
      <strong style="color:${NAVY};">${escapeHtml(reference)}</strong> and we'll sort it out.</p>`;

  return {
    subject: `${rupees(amountPaise)} refunded — ${tripTitle} (${reference})`,
    html: layout({
      heading: `${rupees(amountPaise)} is on its way back.`,
      body,
      preheader: returned.wait
        ? `${reference} · ${rupees(amountPaise)} on its way back`
        : `${reference} · ${rupees(amountPaise)} returned ${returned.how}`,
    }),
    text:
      `Hi ${name}, we've returned ${rupees(amountPaise)} ${returned.how}, for ${tripTitle}.\n\n` +
      `Booking reference: ${reference}\n` +
      `Refunded now: ${rupees(amountPaise)}\n` +
      (externalReference ? `Reference: ${externalReference}\n` : "") +
      (partial ? `Refunded in total: ${rupees(refundedTotalPaise)}\n` : "") +
      `You paid: ${rupees(paidPaise)}\n` +
      (full ? `Still with us: nothing\n` : "") +
      (returned.wait ? `\n${returned.wait}\n` : "") +
      `\nIf anything here doesn't match what you received, reply quoting ${reference} and ` +
      `we'll sort it out.\n\n${siteConfig.url}/account\n`,
  };
}
