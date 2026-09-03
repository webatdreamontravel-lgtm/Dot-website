import "server-only";

import { balanceReminderEmail, sendEmail } from "@/emails";

/**
 * Sending one balance reminder.
 *
 * Shared by the nightly cron and the "send now" button in the admin, so a
 * manual nudge is the same email the customer would have received anyway —
 * no second template to keep in step, no risk of the two drifting apart.
 *
 * The two callers differ only in the dedupe key. The cron keys on the day
 * offset, so each morning's reminder is distinct but can't be sent twice.
 * The admin keys on the calendar date in its own namespace, so a person can
 * always nudge someone today even if the automated one already went — while
 * a double-clicked button still only sends once.
 */

export type ReminderOutcome =
  | { ok: true; sent: true; to: string }
  | {
      ok: true;
      sent: false;
      /**
       * "already-sent" is the dedupe key doing its job — this morning's
       * reminder for this booking has already gone out. Reported as not-sent
       * rather than sent so a re-run of the cron reports honestly instead of
       * claiming credit for an email it suppressed.
       */
      reason: "no-balance" | "no-email" | "not-active" | "already-sent";
    }
  | { ok: false; error: string };

export type ReminderBooking = {
  id: string;
  reference: string;
  status: string;
  totalPaise: number;
  amountPaidPaise: number;
  trip: { title: string; slug: string; startDate: Date };
  profile: { email: string | null; fullName: string | null };
  travellers: { fullName: string; email: string | null }[];
  /** The unpaid schedule, earliest first. Empty when paid in full up front. */
  instalments: { dueDate: Date }[];
};

/** Whole days from today (UTC) until a trip departs. Negative once it has. */
export function daysUntil(startDate: Date): number {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setUTCHours(0, 0, 0, 0);
  return Math.round((start.getTime() - today.getTime()) / 86_400_000);
}

export async function sendBalanceReminder(
  booking: ReminderBooking,
  opts: { dedupeKey: string },
): Promise<ReminderOutcome> {
  if (!["CONFIRMED", "REQUESTED"].includes(booking.status)) {
    return { ok: true, sent: false, reason: "not-active" };
  }

  // Every balance is chased, however small. There is deliberately no
  // threshold: one that could be set above zero would silently stop chasing
  // small debts with nothing anywhere to say it had.
  const balance = booking.totalPaise - booking.amountPaidPaise;
  if (balance <= 0) return { ok: true, sent: false, reason: "no-balance" };

  const to = booking.profile.email ?? booking.travellers[0]?.email;
  if (!to) return { ok: true, sent: false, reason: "no-email" };

  const mail = balanceReminderEmail({
    name: booking.profile.fullName ?? booking.travellers[0]?.fullName ?? "there",
    reference: booking.reference,
    tripTitle: booking.trip.title,
    tripSlug: booking.trip.slug,
    startDate: booking.trip.startDate,
    daysUntil: Math.max(daysUntil(booking.trip.startDate), 0),
    // The earliest thing still owed — what "due by" means to this customer.
    dueDate: booking.instalments[0]?.dueDate ?? null,
    balancePaise: balance,
    paidPaise: booking.amountPaidPaise,
    totalPaise: booking.totalPaise,
  });

  const result = await sendEmail({
    to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    template: "balance_reminder",
    bookingId: booking.id,
    dedupeKey: opts.dedupeKey,
  });

  if (!result.ok) return { ok: false, error: result.error };
  if (result.deduped) return { ok: true, sent: false, reason: "already-sent" };
  return { ok: true, sent: true, to };
}

/**
 * The shape sendBalanceReminder needs.
 *
 * Shared so the cron and the admin action select identically — a field
 * missing from one of them would fail at runtime, in a cron nobody watches.
 */
export const reminderSelect = {
  id: true,
  reference: true,
  status: true,
  totalPaise: true,
  amountPaidPaise: true,
  trip: { select: { title: true, slug: true, startDate: true } },
  profile: { select: { email: true, fullName: true } },
  travellers: {
    where: { cancelledAt: null },
    select: { fullName: true, email: true },
    orderBy: { createdAt: "asc" as const },
    take: 1,
  },
  instalments: {
    where: { status: "PENDING" as const },
    select: { dueDate: true },
    orderBy: { sequence: "asc" as const },
    take: 1,
  },
} as const;
