import { siteConfig } from "@/lib/data/siteConfig";
import { button, CREAM, escapeHtml, layout, MUTED, NAVY } from "./layout";

/**
 * The one nobody wants to send: paid, but the seat was gone.
 *
 * This happens when a bank authorises a payment after our seat hold has
 * lapsed and the trip has filled in the meantime. It is rare, and it is
 * entirely our problem to sort out — so the mail says exactly that, gives a
 * commitment on when they'll hear from a human, and states plainly that the
 * money is safe. It deliberately does not ask them to do anything.
 *
 * No apology theatre and no jargon: someone who has just paid ₹80,000 for a
 * trip to Vietnam needs to know their money is accounted for, not to read
 * the phrase "seat hold expiry".
 */
export function seatUnavailableEmail({
  name,
  reference,
  tripTitle,
  paidPaise,
}: {
  name: string;
  reference: string;
  tripTitle: string;
  paidPaise: number;
}) {
  const rupees = "₹" + (paidPaise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });

  const body = `
    <p style="margin:0 0 14px;">Hi ${escapeHtml(name)} — your payment of
      <strong style="color:${NAVY};">${rupees}</strong> for
      <strong style="color:${NAVY};">${escapeHtml(tripTitle)}</strong> came through, but the
      last seat was taken moments before it reached us.</p>

    <p style="margin:0 0 14px;">That's on us, not you. Your money is recorded against booking
      <strong style="color:${NAVY};">${escapeHtml(reference)}</strong> and is completely safe.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="margin:18px 0;padding:16px 18px;background:${CREAM};border-radius:12px;">
      <tr><td style="font-size:14px;color:${MUTED};line-height:1.6;">
        <strong style="color:${NAVY};">One of us will call you within one working day</strong>
        with two options: a seat on the next departure of the same trip, or a full refund
        back to the account you paid from. Whichever you prefer.
      </td></tr>
    </table>

    <p style="margin:0 0 6px;">There's nothing you need to do in the meantime. If you'd rather
      not wait for our call, reply to this email or message us on WhatsApp and we'll sort it
      out straight away.</p>

    ${button(`${siteConfig.url}/account`, "View your booking")}

    <p style="margin:16px 0 0;font-size:13px;">Quote
      <strong style="color:${NAVY};">${escapeHtml(reference)}</strong> if you get in touch.</p>`;

  return {
    subject: `About your booking ${reference} — we need to sort something out`,
    html: layout({
      heading: "Your payment went through — but the seat didn't.",
      body,
      preheader: `${reference} · ${rupees} received · we'll call you within a working day`,
    }),
    text:
      `Hi ${name}, your payment of ${rupees} for ${tripTitle} came through, but the last seat ` +
      `was taken moments before it reached us.\n\n` +
      `That's on us. Your money is recorded against booking ${reference} and is safe.\n\n` +
      `One of us will call you within one working day with two options: a seat on the next ` +
      `departure, or a full refund to the account you paid from.\n\n` +
      `Nothing for you to do in the meantime. Reply to this email if you'd rather not wait.\n`,
  };
}
