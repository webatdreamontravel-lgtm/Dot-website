import { siteConfig } from "@/lib/data/siteConfig";
import { escapeHtml, layout, MUTED, NAVY } from "./layout";

/**
 * A refund has actually left the account. The team wants to know.
 *
 * Razorpay confirms a refund asynchronously — hours, sometimes days, after
 * the button was clicked. Until this arrives the money is in limbo: the
 * booking screen shows it as pending, carrying the booking forward is
 * blocked, and nobody can close the books on it. Nothing was telling the
 * team when that ended, so the only way to find out was to keep reopening
 * the booking.
 *
 * The customer gets their own email at the same moment — refundProcessed.
 * This one is the operational half: what it leaves behind, and what is now
 * unblocked.
 */
export function refundProcessedAdminEmail({
  reference,
  tripTitle,
  customerEmail,
  amountPaise,
  refundedTotalPaise,
  paidPaise,
  razorpayRefundId,
}: {
  reference: string;
  tripTitle: string;
  /** Null when there is nobody to tell — which is worth saying out loud. */
  customerEmail: string | null;
  /** This refund. */
  amountPaise: number;
  /** Every PROCESSED refund on the booking, including this one. */
  refundedTotalPaise: number;
  paidPaise: number;
  razorpayRefundId: string;
}) {
  const rupees = (p: number) =>
    "₹" + (p / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  const url = `${siteConfig.url}/admin/bookings/${encodeURIComponent(reference)}`;

  // What is still ours out of what they paid. Never negative: a goodwill
  // refund above the paid total is a real thing, and "-₹500 still held"
  // is not a sentence.
  const stillHeldPaise = Math.max(paidPaise - refundedTotalPaise, 0);
  const fullyReturned = refundedTotalPaise >= paidPaise && paidPaise > 0;

  const body = `
    <p style="margin:0 0 12px;">Razorpay has sent
      <strong style="color:${NAVY};">${rupees(amountPaise)}</strong> back on
      <strong style="color:${NAVY};">${escapeHtml(reference)}</strong>
      (${escapeHtml(tripTitle)}). ${
        customerEmail
          ? `${escapeHtml(customerEmail)} has been emailed.`
          : `<strong style="color:${NAVY};">No email on file</strong> — nobody has told them.`
      }</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0;">
      <tr><td style="padding:5px 0;color:${MUTED};font-size:14px;">This refund</td>
          <td style="padding:5px 0;text-align:right;font-size:14px;color:${NAVY};">${rupees(amountPaise)}</td></tr>
      <tr><td style="padding:5px 0;color:${MUTED};font-size:14px;">Refunded in total</td>
          <td style="padding:5px 0;text-align:right;font-size:14px;color:${NAVY};">${rupees(refundedTotalPaise)} of ${rupees(paidPaise)} paid</td></tr>
      <tr><td style="padding:5px 0;color:${MUTED};font-size:14px;">Still held</td>
          <td style="padding:5px 0;text-align:right;font-size:14px;color:${NAVY};">${rupees(stillHeldPaise)}</td></tr>
      <tr><td style="padding:5px 0;color:${MUTED};font-size:14px;">Refund id</td>
          <td style="padding:5px 0;text-align:right;font-size:13px;font-family:monospace;color:${NAVY};">${escapeHtml(razorpayRefundId)}</td></tr>
    </table>

    <p style="margin:0;font-size:14px;">${
      fullyReturned
        ? "Everything they paid has now gone back."
        : "The booking can be carried forward or refunded further from"
    }
      <a href="${url}" style="color:#1d8a8a;">the booking screen</a>.</p>`;

  return {
    subject: `Refund sent — ${reference} (${rupees(amountPaise)})`,
    html: layout({
      heading: "A refund has gone through.",
      body,
      preheader: `${reference} · ${rupees(amountPaise)} returned · ${rupees(stillHeldPaise)} still held`,
    }),
    text:
      `Razorpay has sent ${rupees(amountPaise)} back on ${reference} (${tripTitle}).\n` +
      (customerEmail
        ? `${customerEmail} has been emailed.\n\n`
        : "No email on file — nobody has told them.\n\n") +
      `This refund: ${rupees(amountPaise)}\n` +
      `Refunded in total: ${rupees(refundedTotalPaise)} of ${rupees(paidPaise)} paid\n` +
      `Still held: ${rupees(stillHeldPaise)}\n` +
      `Refund id: ${razorpayRefundId}\n\n` +
      (fullyReturned
        ? "Everything they paid has now gone back.\n"
        : "The booking can be carried forward or refunded further.\n") +
      `${url}\n`,
  };
}
