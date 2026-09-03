import "server-only";

import { prisma } from "@/lib/prisma";

import { activeProvider, deliver } from "./providers";

/**
 * Outbound email, with a record of every attempt.
 *
 * Everything goes through here rather than calling a provider directly, so
 * that a booking confirmation that silently failed to send is visible in the
 * email_logs table instead of being lost. Sending is never allowed to break
 * the thing that triggered it — a confirmed booking must not roll back
 * because an inbox was unreachable.
 *
 * Which provider actually carries the message is chosen by EMAIL_PROVIDER;
 * see ./providers. Everything below is identical either way.
 */

const from = process.env.EMAIL_FROM ?? "Dream On Travel <onboarding@resend.dev>";

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

  const provider = activeProvider();

  // deliver() is written never to throw, but a booking must not roll back if
  // that contract is ever broken — so this stays wrapped regardless.
  let result;
  try {
    result = await deliver(provider, { from, to, subject, html, text });
  } catch (e) {
    result = { ok: false as const, error: e instanceof Error ? e.message : String(e) };
  }

  if (!result.ok) {
    await prisma.emailLog.update({
      where: { id: log.id },
      // The provider is recorded in the error text because email_log has no
      // column for it — without this you cannot tell, from the table alone,
      // which side of the EMAIL_PROVIDER switch a failure came from.
      data: { status: "FAILED", error: `[${provider}] ${result.error}` },
    });
    console.error(`[email] ${template} to ${to} failed via ${provider}:`, result.error);
    return { ok: false, error: result.error };
  }

  await prisma.emailLog.update({
    where: { id: log.id },
    data: { status: "SENT", providerId: result.id, sentAt: new Date() },
  });
  return { ok: true, id: result.id };
}
