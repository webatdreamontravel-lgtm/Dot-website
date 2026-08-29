import { siteConfig } from "@/lib/data/siteConfig";
import { button, CREAM, escapeHtml, layout, MUTED, NAVY } from "./layout";

/**
 * The receipt someone gets the moment their seat is paid for.
 *
 * Leads with the booking reference because that is the thing they will be
 * asked for on WhatsApp, and puts the money in plain figures — what was paid
 * now, and what (if anything) is still owed. A confirmation that hides the
 * balance is how a traveller arrives at the pickup point believing they had
 * paid in full.
 */
export function bookingConfirmedEmail({
  name,
  reference,
  tripTitle,
  tripSlug,
  startDate,
  endDate,
  startingFrom,
  seats,
  paidPaise,
  totalPaise,
}: {
  name: string;
  reference: string;
  tripTitle: string;
  tripSlug: string;
  startDate: Date;
  endDate: Date;
  startingFrom: string | null;
  seats: number;
  paidPaise: number;
  totalPaise: number;
}) {
  const rupees = (p: number) =>
    "₹" + (p / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  const day = (d: Date) =>
    d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  const balance = Math.max(totalPaise - paidPaise, 0);
  const url = `${siteConfig.url}/account/bookings/${encodeURIComponent(reference)}`;

  const row = (label: string, value: string, strong = false) =>
    `<tr>
       <td style="padding:7px 0;color:${MUTED};font-size:14px;">${escapeHtml(label)}</td>
       <td style="padding:7px 0;text-align:right;font-size:14px;color:${NAVY};${
         strong ? "font-weight:700;" : ""
       }">${escapeHtml(value)}</td>
     </tr>`;

  const body = `
    <p style="margin:0 0 14px;">Hi ${escapeHtml(name)}, you're in — your seat on
      <strong style="color:${NAVY};">${escapeHtml(tripTitle)}</strong> is confirmed.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="margin:18px 0;padding:16px 18px;background:${CREAM};border-radius:12px;">
      ${row("Booking reference", reference, true)}
      ${row("Dates", `${day(startDate)} – ${day(endDate)}`)}
      ${startingFrom ? row("Starting from", startingFrom) : ""}
      ${row("Travellers", String(seats))}
      ${row("Paid now", rupees(paidPaise), true)}
      ${balance > 0 ? row("Balance due before departure", rupees(balance)) : ""}
    </table>

    ${
      /**
       * The balance can be paid from the booking page the moment this email
       * lands, so say so. This used to read "we'll be in touch nearer the
       * time — nothing to do about it today", which was written before that
       * button existed and told people to wait for something they could
       * already do themselves.
       *
       * Still no urgency: it names the deadline and the reminder, so nobody
       * reads a confirmation as a demand for more money.
       */
      balance > 0
        ? `<p style="margin:0 0 14px;">The remaining ${rupees(balance)} is due before
             departure — you can pay it whenever you like from your booking page, and
             we'll send a reminder closer to the trip.</p>`
        : `<p style="margin:0 0 14px;">That's the full amount settled. Nothing else to pay.</p>`
    }

    <p style="margin:0 0 6px;">Next: we'll add you to the trip's WhatsApp group about a
      week before departure, with the packing list and pickup details.</p>

    ${button(url, balance > 0 ? `Pay ${rupees(balance)} now` : "View your booking")}

    <p style="margin:16px 0 0;font-size:13px;">Quote <strong style="color:${NAVY};">${escapeHtml(
      reference,
    )}</strong> if you need to reach us. Full trip details are on the
      <a href="${siteConfig.url}/trips/${encodeURIComponent(
        tripSlug,
      )}" style="color:#1d8a8a;">trip page</a>.</p>`;

  return {
    subject: `Confirmed — ${tripTitle} (${reference})`,
    html: layout({
      heading: "You're going.",
      body,
      preheader: `${reference} · ${day(startDate)} · ${rupees(paidPaise)} paid`,
    }),
    text:
      `Hi ${name}, your seat on ${tripTitle} is confirmed.\n\n` +
      `Reference: ${reference}\n` +
      `Dates: ${day(startDate)} - ${day(endDate)}\n` +
      (startingFrom ? `Starting from: ${startingFrom}\n` : "") +
      `Travellers: ${seats}\n` +
      `Paid now: ${rupees(paidPaise)}\n` +
      (balance > 0 ? `Balance due before departure: ${rupees(balance)}\n` : "") +
      (balance > 0
        ? `\nYou can pay the remaining ${rupees(balance)} whenever you like — we'll also ` +
          `send a reminder closer to the trip.\n`
        : "") +
      `\nYour booking: ${url}\n`,
  };
}

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
