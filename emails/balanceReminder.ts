import { siteConfig } from "@/lib/data/siteConfig";
import { button, CREAM, escapeHtml, layout, MUTED, NAVY } from "./layout";

/**
 * "Your balance is due" — sent a set number of days before departure.
 *
 * Written to be useful rather than nagging. It leads with what is owed and
 * a link that goes straight to paying it, because the most common reason a
 * balance goes unpaid is that nobody knew how. The trip and the date are
 * there so it reads as a reminder about a holiday rather than an invoice.
 *
 * The number of days, and how many reminders go out, are configured in
 * site_settings — see lib/config/reminders.ts.
 */
export function balanceReminderEmail({
  name,
  reference,
  tripTitle,
  tripSlug,
  startDate,
  daysUntil,
  dueDate,
  balancePaise,
  paidPaise,
  totalPaise,
}: {
  name: string;
  reference: string;
  tripTitle: string;
  tripSlug: string;
  startDate: Date;
  /** How many days from now the trip departs. */
  daysUntil: number;
  /**
   * When the balance was agreed to be due. Optional — a booking paid in
   * full at checkout has no schedule, and neither does one made before
   * instalments existed.
   */
  dueDate?: Date | null;
  balancePaise: number;
  paidPaise: number;
  totalPaise: number;
}) {
  const rupees = (p: number) =>
    "₹" + (p / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  const day = startDate.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const when = describeWhen(daysUntil);

  /**
   * "by Monday 31 August" is a deadline; "outstanding" is a mood.
   *
   * The due date is what the customer actually agreed to, so naming it turns
   * the mail from a nag into a reminder of their own commitment — and gives
   * anyone who wants to argue about it something concrete to point at.
   */
  const due = dueDate
    ? dueDate.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })
    : null;

  const url = `${siteConfig.url}/account/bookings/${encodeURIComponent(reference)}`;

  const body = `
    <p style="margin:0 0 14px;">Hi ${escapeHtml(name)} —
      <strong style="color:${NAVY};">${escapeHtml(tripTitle)}</strong> leaves ${when},
      on ${escapeHtml(day)}. ${
        paidPaise > 0
          ? "There's a balance left to settle before you go."
          : "Your seat isn't paid for yet."
      }</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="margin:18px 0;padding:16px 18px;background:${CREAM};border-radius:12px;">
      ${
        // Only worth breaking down when something has actually been paid.
        // "Already paid ₹0" above "Still to pay ₹2,624" is two lines saying
        // one thing, and it reads like a form rather than a message from
        // someone who knows this customer hasn't paid yet.
        paidPaise > 0
          ? `<tr>
        <td style="padding:6px 0;color:${MUTED};font-size:14px;">Trip total</td>
        <td style="padding:6px 0;text-align:right;font-size:14px;color:${NAVY};">${rupees(totalPaise)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:${MUTED};font-size:14px;">Already paid</td>
        <td style="padding:6px 0;text-align:right;font-size:14px;color:${NAVY};">${rupees(paidPaise)}</td>
      </tr>
      <tr>
        <td style="padding:10px 0 0;border-top:1px solid rgba(15,30,61,0.1);color:${NAVY};font-size:15px;font-weight:700;">Still to pay${
          due ? `<span style="display:block;font-weight:400;font-size:13px;color:${MUTED};">by ${escapeHtml(due)}</span>` : ""
        }</td>
        <td style="padding:10px 0 0;border-top:1px solid rgba(15,30,61,0.1);text-align:right;color:${NAVY};font-size:18px;font-weight:700;">${rupees(balancePaise)}</td>
      </tr>`
          : `<tr>
        <td style="padding:4px 0;color:${MUTED};font-size:14px;">Amount due${
          due ? `<span style="display:block;font-size:13px;">by ${escapeHtml(due)}</span>` : ""
        }</td>
        <td style="padding:4px 0;text-align:right;color:${NAVY};font-size:18px;font-weight:700;">${rupees(balancePaise)}</td>
      </tr>`
      }
    </table>

    ${button(url, `Pay ${rupees(balancePaise)} now`)}

    <p style="margin:14px 0 0;">Paying by UPI or bank transfer instead? Just reply to this
      email and we'll send you the details — quote
      <strong style="color:${NAVY};">${escapeHtml(reference)}</strong>.</p>

    <p style="margin:12px 0 0;font-size:13px;">Everything about the trip is on the
      <a href="${siteConfig.url}/trips/${encodeURIComponent(tripSlug)}" style="color:#1d8a8a;">trip page</a>.
      Any questions at all, just reply.</p>`;

  return {
    subject: reminderSubject(daysUntil, tripTitle, rupees(balancePaise)),
    html: layout({
      heading: `${tripTitle} leaves ${when}.`,
      body,
      preheader: `${rupees(balancePaise)} still to pay · ${reference}`,
    }),
    text:
      `Hi ${name}, ${tripTitle} leaves ${when}, on ${day}.\n\n` +
      (paidPaise > 0
        ? `Trip total: ${rupees(totalPaise)}\n` +
          `Already paid: ${rupees(paidPaise)}\n` +
          `Still to pay: ${rupees(balancePaise)}${due ? ` (by ${due})` : ""}\n\n`
        : `Amount due: ${rupees(balancePaise)}${due ? ` (by ${due})` : ""}\n\n`) +
      `Pay now: ${url}\n\n` +
      `Prefer UPI or bank transfer? Reply to this email quoting ${reference}.\n`,
  };
}

/**
 * How far away the trip is, in words.
 *
 * "in 3 weeks" reads better than "in 21 days" at a distance; close in, the
 * exact number is what creates the urgency.
 */
export function describeWhen(daysUntil: number): string {
  if (daysUntil <= 0) return "today";
  if (daysUntil === 1) return "tomorrow";
  if (daysUntil === 7) return "in a week";
  if (daysUntil === 14) return "in two weeks";
  if (daysUntil < 14) return `in ${daysUntil} days`;
  return `in ${Math.round(daysUntil / 7)} weeks`;
}

/**
 * The subject line, derived from how close the trip is.
 *
 * Every reminder in a run must have a DIFFERENT subject. Five mornings of
 * "₹1,611 left to pay for Walayar" reads as a loop that isn't listening: the
 * recipient stops opening them, and the last one — the one that actually
 * matters — goes unread beneath four identical copies. Mail clients are also
 * quicker to bundle away repeated identical subjects.
 *
 * The day count is therefore always present from two days out, which
 * guarantees distinctness however long the window is, and the phrasing
 * shifts at the boundaries people actually think in: a week, a fortnight,
 * tomorrow, today.
 *
 * Derived rather than a fixed table on purpose — dailyFinalDays is a
 * setting, so a hard-coded list of five would silently start repeating the
 * moment someone set it to ten.
 */
export function reminderSubject(
  daysUntil: number,
  tripTitle: string,
  amount: string,
): string {
  if (daysUntil <= 0) return `Today — ${amount} still to pay for ${tripTitle}`;
  if (daysUntil === 1) return `Tomorrow — ${amount} still to pay for ${tripTitle}`;
  if (daysUntil === 7) return `One week to ${tripTitle} — ${amount} to settle`;
  if (daysUntil === 14) return `Two weeks to ${tripTitle} — ${amount} to settle`;

  // Everything else carries the exact day count.
  //
  // Never a rounded "in 3 weeks" here, however natural that reads: rounding
  // maps several days onto one phrase, so a long window would repeat itself
  // — a 21-day run produced only 16 distinct subjects, with days 15–17 all
  // reading "in 2 weeks". The body says it in words; the subject has the one
  // job of being different from yesterday's.
  const tone = daysUntil < 7 ? "outstanding" : "to settle";
  return `${daysUntil} days to ${tripTitle} — ${amount} ${tone}`;
}
