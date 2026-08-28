import { siteConfig } from "@/lib/data/siteConfig";

/**
 * Email templates.
 *
 * Table layout and inline styles throughout: Outlook and Gmail strip
 * <style> blocks and ignore flexbox, so anything cleverer than this renders
 * as a stack of unstyled text in the clients most people actually use.
 */

const NAVY = "#0f1e3d";
const CREAM = "#fef9e7";
const YELLOW = "#f4c542";
const MUTED = "#5a6785";

export function layout({ heading, body, preheader }: {
  heading: string;
  body: string;
  /** The grey line after the subject in an inbox list. */
  preheader: string;
}) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:0;background:${CREAM};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:32px 16px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fffdf5;border-radius:16px;border:1px solid rgba(15,30,61,0.08);">
    <tr><td style="padding:28px 32px 0;">
      <span style="display:inline-block;width:34px;height:34px;line-height:34px;text-align:center;border-radius:50%;background:${YELLOW};color:${NAVY};font-weight:700;font-size:12px;">DOT</span>
      <span style="margin-left:10px;font-size:17px;font-weight:600;color:${NAVY};">${siteConfig.name}</span>
    </td></tr>
    <tr><td style="padding:22px 32px 0;">
      <h1 style="margin:0;font-size:25px;line-height:1.25;color:${NAVY};font-weight:700;">${heading}</h1>
    </td></tr>
    <tr><td style="padding:14px 32px 30px;font-size:15px;line-height:1.6;color:${MUTED};">${body}</td></tr>
  </table>
  <p style="max-width:520px;margin:18px auto 0;font-size:12px;line-height:1.6;color:rgba(15,30,61,0.45);text-align:center;">
    ${siteConfig.name} · a strangers-to-friends travel community<br>
    Not expecting this? You can safely ignore it.
  </p>
</td></tr></table></body></html>`;
}

export function button(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0;">
    <tr><td style="border-radius:999px;background:${NAVY};">
      <a href="${href}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:${CREAM};text-decoration:none;border-radius:999px;">${label}</a>
    </td></tr></table>`;
}

/**
 * Confirms someone owns the address they signed up with.
 *
 * Leads with a code rather than a link: the person is still sitting on the
 * signup screen waiting, and a code lets them finish there instead of
 * bouncing out to their inbox and back. The link is kept underneath for
 * anyone who'd rather just tap it, or who opens the mail on another device.
 */
export function verificationEmail({
  name,
  code,
  confirmUrl,
}: {
  name: string | null;
  code: string;
  confirmUrl: string;
}) {
  const greeting = name ? `Hi ${escapeHtml(name.split(" ")[0])},` : "Hi,";
  const spaced = code.replace(/\s+/g, "");

  return {
    // The code is in the subject so it's readable from the notification
    // banner without opening anything.
    subject: `${spaced} is your Dream On Travel code`,
    html: layout({
      heading: "Your verification code",
      preheader: `${spaced} — enter this to finish setting up your account.`,
      body: `
        <p style="margin:0 0 14px;">${greeting}</p>
        <p style="margin:0 0 4px;">Welcome to ${siteConfig.name}. Enter this code on the signup screen to finish:</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;">
          <tr><td style="border-radius:12px;background:${CREAM};border:1px solid rgba(15,30,61,0.1);padding:16px 28px;">
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:30px;font-weight:700;letter-spacing:6px;color:${NAVY};">${spaced}</span>
          </td></tr>
        </table>
        <p style="margin:0 0 16px;font-size:13px;">The code expires in an hour and can only be used once.</p>
        <p style="margin:0 0 6px;font-size:13px;">Not on that screen any more? Tap this instead:</p>
        <p style="margin:0;font-size:13px;word-break:break-all;">
          <a href="${confirmUrl}" style="color:${MUTED};">${confirmUrl}</a></p>`,
    }),
    text: `${greeting}

Welcome to ${siteConfig.name}. Your verification code is:

    ${spaced}

Enter it on the signup screen to finish. It expires in an hour and works once.

Not on that screen any more? Use this link instead:
${confirmUrl}

If you weren't expecting this, you can ignore it.`,
  };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

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
  const url = `${siteConfig.url}/account`;

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
      balance > 0
        ? `<p style="margin:0 0 14px;">We'll be in touch about the remaining
             ${rupees(balance)} nearer the time — nothing to do about it today.</p>`
        : `<p style="margin:0 0 14px;">That's the full amount settled. Nothing else to pay.</p>`
    }

    <p style="margin:0 0 6px;">Next: we'll add you to the trip's WhatsApp group about a
      week before departure, with the packing list and pickup details.</p>

    ${button(url, "View your booking")}

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
      `\nView your booking: ${url}\n`,
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
