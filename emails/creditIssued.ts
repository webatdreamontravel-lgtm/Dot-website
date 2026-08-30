import { siteConfig } from "@/lib/data/siteConfig";
import { button, CREAM, escapeHtml, layout, MUTED, NAVY } from "./layout";

/**
 * Sent when a cancelled booking's money is kept as travel credit.
 *
 * The email a customer least expects and most needs. They cancelled, no money
 * came back, and without this the only evidence their ₹4,000 still exists is
 * a conversation they had on the phone. Six months later, when they want to
 * use it, this is what they will search their inbox for — so it leads with
 * the amount and gets out of the way.
 *
 * It does NOT show the cancellation charge as a line item. The charge is
 * whatever the team decided, the credit is the number that matters to the
 * customer, and putting the deduction in a table invites a negotiation over
 * email rather than a call.
 */
export function creditIssuedEmail({
  name,
  reference,
  tripTitle,
  creditPaise,
  note,
}: {
  name: string;
  reference: string;
  tripTitle: string;
  creditPaise: number;
  /** The team's own words about why, if they wrote any. */
  note?: string | null;
}) {
  const rupees = (p: number) =>
    "₹" + (p / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  const url = `${siteConfig.url}/account`;

  const body = `
    <p style="margin:0 0 14px;">Hi ${escapeHtml(name)} — your booking for
      <strong style="color:${NAVY};">${escapeHtml(tripTitle)}</strong> has been cancelled, and
      we've kept <strong style="color:${NAVY};">${rupees(creditPaise)}</strong> as travel credit
      towards a future trip.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="margin:18px 0;padding:18px;background:${CREAM};border-radius:12px;text-align:center;">
      <tr><td>
        <div style="font-size:13px;color:${MUTED};letter-spacing:0.06em;text-transform:uppercase;">Your travel credit</div>
        <div style="margin-top:6px;font-size:32px;font-weight:700;color:${NAVY};">${rupees(creditPaise)}</div>
        <div style="margin-top:6px;font-size:13px;color:${MUTED};">against booking ${escapeHtml(reference)}</div>
      </td></tr>
    </table>

    ${
      note
        ? `<p style="margin:0 0 14px;color:${MUTED};font-size:14px;">${escapeHtml(note)}</p>`
        : ""
    }

    ${button(url, "See your bookings")}

    <p style="margin:16px 0 0;font-size:13px;color:${MUTED};">Any questions about this, just
      reply — quoting <strong style="color:${NAVY};">${escapeHtml(reference)}</strong>.</p>`;

  return {
    subject: `${rupees(creditPaise)} travel credit — ${tripTitle} (${reference})`,
    html: layout({
      heading: `${rupees(creditPaise)} is waiting for your next trip.`,
      body,
      preheader: `${reference} · travel credit towards a future trip`,
    }),
    text:
      `Hi ${name}, your booking for ${tripTitle} has been cancelled, and we've kept ` +
      `${rupees(creditPaise)} as travel credit towards a future trip.\n\n` +
      `YOUR TRAVEL CREDIT: ${rupees(creditPaise)}\n` +
      `Against booking ${reference}\n\n` +
      (note ? `${note}\n\n` : "") +
      `Your bookings: ${url}\n\n` +
      `Any questions, just reply quoting ${reference}.\n`,
  };
}
