import { siteConfig } from "@/lib/data/siteConfig";
import { button, CREAM, escapeHtml, layout, MUTED, NAVY } from "./layout";

/**
 * A receipt for money the team took by hand — cash at a stall, a UPI
 * transfer, a bank deposit.
 *
 * Deliberately separate from bookingConfirmedEmail. That one announces
 * "you're in", which is only true the first time; sending it again for a
 * top-up on a booking confirmed weeks ago is confusing, and sending nothing
 * is worse — the customer handed over ₹3,000 and has no record of it but
 * their own memory.
 *
 * So: when an offline payment CONFIRMS a booking, the caller sends the
 * confirmation and this is skipped. When it lands on a booking that was
 * already confirmed, this goes instead. One receipt per payment either way.
 *
 * The method is named because it is what the customer will search their own
 * records for — "did I pay that in cash or by UPI?" is the question this
 * email exists to answer six weeks later.
 */

const METHOD_LABEL: Record<string, string> = {
  CASH: "in cash",
  UPI_MANUAL: "by UPI",
  BANK_TRANSFER: "by bank transfer",
  RAZORPAY: "online",
  OTHER: "",
};

export function paymentReceivedEmail({
  name,
  reference,
  tripTitle,
  method,
  externalReference,
  amountPaise,
  paidPaise,
  totalPaise,
}: {
  name: string;
  reference: string;
  tripTitle: string;
  method: string;
  /** UTR or receipt number the admin typed in, if any. */
  externalReference?: string | null;
  /** This payment. */
  amountPaise: number;
  /** Everything paid on the booking, including this one. */
  paidPaise: number;
  totalPaise: number;
}) {
  const rupees = (p: number) =>
    "₹" + (p / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });

  const balance = Math.max(totalPaise - paidPaise, 0);
  const how = METHOD_LABEL[method] ?? "";
  const url = `${siteConfig.url}/account/bookings/${encodeURIComponent(reference)}`;

  const row = (label: string, value: string, strong = false) =>
    `<tr>
       <td style="padding:7px 0;color:${MUTED};font-size:14px;">${escapeHtml(label)}</td>
       <td style="padding:7px 0;text-align:right;font-size:14px;color:${NAVY};${
         strong ? "font-weight:700;" : ""
       }">${escapeHtml(value)}</td>
     </tr>`;

  const settled = balance === 0;

  const body = `
    <p style="margin:0 0 14px;">Hi ${escapeHtml(name)} — we've received
      <strong style="color:${NAVY};">${rupees(amountPaise)}</strong>${how ? ` ${how}` : ""}
      towards <strong style="color:${NAVY};">${escapeHtml(tripTitle)}</strong>.
      ${settled ? "That settles it in full — nothing more to pay." : ""}</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="margin:18px 0;padding:16px 18px;background:${CREAM};border-radius:12px;">
      ${row("Booking reference", reference, true)}
      ${row("This payment", rupees(amountPaise))}
      ${externalReference ? row("Reference", externalReference) : ""}
      ${row("Paid so far", `${rupees(paidPaise)} of ${rupees(totalPaise)}`)}
      ${
        settled
          ? row("Still to pay", "Nothing — paid in full", true)
          : row("Still to pay", rupees(balance), true)
      }
    </table>

    ${button(url, "View your booking")}

    <p style="margin:14px 0 0;font-size:13px;color:${MUTED};">Keep this for your records. If any
      of the above doesn't match what you paid, reply to this email and we'll sort it out.</p>`;

  return {
    subject: settled
      ? `Paid in full — ${tripTitle} (${reference})`
      : `We've received ${rupees(amountPaise)} — ${tripTitle} (${reference})`,
    html: layout({
      heading: settled ? "That's paid in full." : `${rupees(amountPaise)} received.`,
      body,
      preheader: settled
        ? `${reference} · nothing left to pay`
        : `${reference} · ${rupees(balance)} still to pay`,
    }),
    text:
      `Hi ${name}, we've received ${rupees(amountPaise)}${how ? ` ${how}` : ""} towards ${tripTitle}.\n\n` +
      `Booking reference: ${reference}\n` +
      `This payment: ${rupees(amountPaise)}\n` +
      (externalReference ? `Reference: ${externalReference}\n` : "") +
      `Paid so far: ${rupees(paidPaise)} of ${rupees(totalPaise)}\n` +
      (settled ? `Still to pay: nothing — paid in full\n` : `Still to pay: ${rupees(balance)}\n`) +
      `\nYour booking: ${url}\n\n` +
      `If any of the above doesn't match what you paid, just reply.\n`,
  };
}
