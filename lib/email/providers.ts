import "server-only";

import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import { Resend } from "resend";

/**
 * The two ways an email can physically leave the app.
 *
 * Which one is used is a deployment decision, not a per-call one: EMAIL_PROVIDER
 * selects it and every email in the process goes the same way. That keeps the
 * question "where did this email come from?" answerable from config alone,
 * rather than depending on which code path sent it.
 *
 * send.ts owns logging, dedupe and the promise that sending never breaks the
 * thing that triggered it. This module only knows how to hand bytes to a
 * provider — so neither function here ever throws.
 */

export type EmailProvider = "resend" | "ses";

export type DeliveryResult = { ok: true; id: string | null } | { ok: false; error: string };

export type Outbound = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
};

/** Unset behaves exactly as before this switch existed. */
const FALLBACK: EmailProvider = "resend";

export function activeProvider(): EmailProvider {
  const raw = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
  if (!raw) return FALLBACK;
  if (raw === "resend" || raw === "ses") return raw;

  // A typo must not silently stop email. Say so loudly and keep sending.
  console.warn(
    `[email] EMAIL_PROVIDER="${raw}" is not recognised (expected "resend" or "ses"). Using ${FALLBACK}.`,
  );
  return FALLBACK;
}

// ── Resend ───────────────────────────────────────────────────────────────────

// Cached per process: constructing a client per send would throw away
// connection reuse.
let resendClient: Resend | null = null;

function resend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  resendClient ??= new Resend(apiKey);
  return resendClient;
}

async function viaResend(message: Outbound): Promise<DeliveryResult> {
  const client = resend();
  if (!client) return { ok: false, error: "RESEND_API_KEY is not set" };

  try {
    const { data, error } = await client.emails.send({
      from: message.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });

    // Resend reports failures in the body rather than by throwing.
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ── Amazon SES ───────────────────────────────────────────────────────────────

let sesClient: SESv2Client | null = null;

function ses(): SESv2Client | null {
  // Same AWS_REGION as S3 — so the SES domain identity must be verified in
  // that region. Identities do not cross regions: a domain verified in
  // ap-south-1 simply does not exist in us-east-1, and sends there fail as
  // though it were never verified.
  const region = process.env.AWS_REGION?.trim();
  if (!region) return null;

  // Credentials come from the SDK's default chain — the same
  // AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY that S3 uses, or an instance
  // role in production. That one IAM user therefore needs ses:SendEmail on
  // top of its bucket permissions.
  sesClient ??= new SESv2Client({ region });
  return sesClient;
}

async function viaSes(message: Outbound): Promise<DeliveryResult> {
  const client = ses();
  if (!client) return { ok: false, error: "AWS_REGION is not set" };

  try {
    const out = await client.send(
      new SendEmailCommand({
        // Accepts "Name <address@domain>"; the address must be a verified
        // identity, or a subdomain/address of a verified domain.
        FromEmailAddress: message.from,
        Destination: { ToAddresses: [message.to] },
        Content: {
          Simple: {
            Subject: { Data: message.subject, Charset: "UTF-8" },
            Body: {
              Html: { Data: message.html, Charset: "UTF-8" },
              Text: { Data: message.text, Charset: "UTF-8" },
            },
          },
        },
      }),
    );

    return { ok: true, id: out.MessageId ?? null };
  } catch (e) {
    // While the account is in the SES sandbox this is where you land when
    // emailing an unverified recipient: MessageRejected, "Email address is
    // not verified". It means the account, not the address, needs attention.
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ── Dispatch ─────────────────────────────────────────────────────────────────

export function deliver(provider: EmailProvider, message: Outbound): Promise<DeliveryResult> {
  return provider === "ses" ? viaSes(message) : viaResend(message);
}
