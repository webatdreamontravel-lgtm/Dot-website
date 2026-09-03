import { siteConfig } from "@/lib/data/siteConfig";
import { escapeHtml, layout, MUTED, NAVY } from "./layout";

/**
 * Razorpay refused or abandoned a refund. Nobody else will notice.
 *
 * A failed refund is invisible from every direction: the customer is told
 * nothing because nothing was sent, the admin screen shows a FAILED row only
 * if someone opens that booking, and the money quietly stays with us. Left
 * alone it becomes a chargeback or a complaint weeks later, which is the
 * worst possible way to find out.
 *
 * Deliberately admin-only. The customer should hear a decision, not a
 * technical failure they can do nothing about — the team retries it and then
 * tells them what happened.
 */
export function refundFailedAdminEmail({
  reference,
  tripTitle,
  customerEmail,
  amountPaise,
  razorpayRefundId,
  reason,
}: {
  reference: string;
  tripTitle: string;
  customerEmail: string;
  amountPaise: number;
  razorpayRefundId: string;
  reason?: string | null;
}) {
  const rupees = (p: number) =>
    "₹" + (p / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  const url = `${siteConfig.url}/admin/bookings/${encodeURIComponent(reference)}`;

  const body = `
    <p style="margin:0 0 12px;">Razorpay reported that a refund of
      <strong style="color:${NAVY};">${rupees(amountPaise)}</strong> on
      <strong style="color:${NAVY};">${escapeHtml(reference)}</strong>
      (${escapeHtml(tripTitle)}) <strong style="color:${NAVY};">failed</strong>.</p>

    <p style="margin:0 0 12px;">The money is still with us. The customer has
      <strong style="color:${NAVY};">not</strong> been told — they were never
      promised this refund had gone.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0;">
      <tr><td style="padding:5px 0;color:${MUTED};font-size:14px;">Customer</td>
          <td style="padding:5px 0;text-align:right;font-size:14px;color:${NAVY};">${escapeHtml(customerEmail)}</td></tr>
      <tr><td style="padding:5px 0;color:${MUTED};font-size:14px;">Refund id</td>
          <td style="padding:5px 0;text-align:right;font-size:13px;font-family:monospace;color:${NAVY};">${escapeHtml(razorpayRefundId)}</td></tr>
      ${
        reason
          ? `<tr><td style="padding:5px 0;color:${MUTED};font-size:14px;">Reason</td>
                 <td style="padding:5px 0;text-align:right;font-size:14px;color:${NAVY};">${escapeHtml(reason)}</td></tr>`
          : ""
      }
    </table>

    <p style="margin:0;font-size:14px;">Retry it from
      <a href="${url}" style="color:#1d8a8a;">the booking screen</a>, or return the money
      another way and record it there.</p>`;

  return {
    subject: `⚠ Refund failed — ${reference} (${rupees(amountPaise)})`,
    html: layout({
      heading: "A refund didn't go through.",
      body,
      preheader: `${reference} · ${rupees(amountPaise)} still with us`,
    }),
    text:
      `Razorpay reported that a refund of ${rupees(amountPaise)} on ${reference} ` +
      `(${tripTitle}) FAILED.\n\n` +
      `The money is still with us. The customer has NOT been told.\n\n` +
      `Customer: ${customerEmail}\n` +
      `Refund id: ${razorpayRefundId}\n` +
      (reason ? `Reason: ${reason}\n` : "") +
      `\nRetry it from ${url}, or return the money another way and record it there.\n`,
  };
}
