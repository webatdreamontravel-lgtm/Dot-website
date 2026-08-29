import { siteConfig } from "@/lib/data/siteConfig";
import { button, CREAM, escapeHtml, layout, MUTED, NAVY } from "./layout";

/** Internal. Sent to the team so a person picks this up the same day. */
export function seatUnavailableAdminEmail({
  reference,
  tripTitle,
  customerEmail,
  customerPhone,
  paidPaise,
}: {
  reference: string;
  tripTitle: string;
  customerEmail: string;
  customerPhone: string | null;
  paidPaise: number;
}) {
  const rupees = "₹" + (paidPaise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  const body = `
    <p style="margin:0 0 14px;">A payment landed after the seat hold expired and the trip was
      already full. The customer has been emailed and told someone will call within a working day.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="margin:18px 0;padding:16px 18px;background:${CREAM};border-radius:12px;font-size:14px;color:${MUTED};">
      <tr><td style="padding:4px 0;">Booking</td><td style="text-align:right;color:${NAVY};font-weight:700;">${escapeHtml(reference)}</td></tr>
      <tr><td style="padding:4px 0;">Trip</td><td style="text-align:right;color:${NAVY};">${escapeHtml(tripTitle)}</td></tr>
      <tr><td style="padding:4px 0;">Paid</td><td style="text-align:right;color:${NAVY};font-weight:700;">${rupees}</td></tr>
      <tr><td style="padding:4px 0;">Customer</td><td style="text-align:right;color:${NAVY};">${escapeHtml(customerEmail)}</td></tr>
      ${customerPhone ? `<tr><td style="padding:4px 0;">Phone</td><td style="text-align:right;color:${NAVY};">${escapeHtml(customerPhone)}</td></tr>` : ""}
    </table>
    <p style="margin:0;">Either find them a seat on the next departure, or refund from the
      booking screen. The booking is sitting as REQUESTED.</p>
    ${button(`${siteConfig.url}/admin/bookings/${encodeURIComponent(reference)}`, "Open the booking")}`;

  return {
    subject: `⚠ Paid but no seat — ${reference} (${rupees})`,
    html: layout({ heading: "A payment needs a human", body, preheader: `${reference} · ${rupees} · ${tripTitle}` }),
    text:
      `A payment landed after the seat hold expired and the trip was full.\n\n` +
      `Booking: ${reference}\nTrip: ${tripTitle}\nPaid: ${rupees}\n` +
      `Customer: ${customerEmail}${customerPhone ? " / " + customerPhone : ""}\n\n` +
      `Find them a seat on the next departure, or refund from the booking screen.\n` +
      `${siteConfig.url}/admin/bookings/${reference}\n`,
  };
}
