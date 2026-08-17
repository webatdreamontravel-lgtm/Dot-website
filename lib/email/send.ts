import "server-only";

import { Resend } from "resend";

import { prisma } from "@/lib/prisma";

/**
 * Outbound email, with a record of every attempt.
 *
 * Everything goes through here rather than calling Resend directly, so that
 * a booking confirmation that silently failed to send is visible in the
 * email_logs table instead of being lost. Sending is never allowed to break
 * the thing that triggered it — a confirmed booking must not roll back
 * because an inbox was unreachable.
 */

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM ?? "Dream On Travel <onboarding@resend.dev>";

// Instantiated lazily: importing this module must not throw in an
// environment that never sends anything (CI, a migration script).
let client: Resend | null = null;
function resend() {
  if (!apiKey) return null;
  client ??= new Resend(apiKey);
  return client;
}

export type SendResult = { ok: true; id: string | null } | { ok: false; error: string };

export async function sendEmail({
  to,
  subject,
  html,
  text,
  template,
  bookingId,
  dedupeKey,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Identifies the template in the log, e.g. "booking_requested". */
  template: string;
  bookingId?: string;
  /**
   * Makes a send idempotent. A retried server action, a double-clicked
   * button or a replayed webhook must not mean two copies in someone's
   * inbox — the unique index on this column is what enforces it.
   */
  dedupeKey?: string;
}): Promise<SendResult> {
  if (dedupeKey) {
    const already = await prisma.emailLog.findUnique({
      where: { dedupeKey },
      select: { id: true, status: true },
    });
    // Only a previous FAILURE is worth retrying; anything else already went.
    if (already && already.status !== "FAILED") {
      return { ok: true, id: null };
    }
  }

  const log = await prisma.emailLog.upsert({
    where: { dedupeKey: dedupeKey ?? `no-dedupe:${crypto.randomUUID()}` },
    update: { status: "QUEUED", error: null },
    create: {
      toEmail: to,
      template,
      subject,
      bookingId: bookingId ?? null,
      dedupeKey: dedupeKey ?? `no-dedupe:${crypto.randomUUID()}`,
      status: "QUEUED",
    },
    select: { id: true },
  });

  const mailer = resend();
  if (!mailer) {
    const error = "RESEND_API_KEY is not set";
    await prisma.emailLog.update({ where: { id: log.id }, data: { status: "FAILED", error } });
    console.warn(`[email] ${template} to ${to} not sent — ${error}`);
    return { ok: false, error };
  }

  try {
    const { data, error } = await mailer.emails.send({ from, to, subject, html, text });

    if (error) {
      await prisma.emailLog.update({
        where: { id: log.id },
        data: { status: "FAILED", error: error.message },
      });
      console.error(`[email] ${template} to ${to} failed:`, error.message);
      return { ok: false, error: error.message };
    }

    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: "SENT", providerId: data?.id ?? null, sentAt: new Date() },
    });
    return { ok: true, id: data?.id ?? null };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: "FAILED", error: message },
    });
    console.error(`[email] ${template} to ${to} threw:`, message);
    return { ok: false, error: message };
  }
}
