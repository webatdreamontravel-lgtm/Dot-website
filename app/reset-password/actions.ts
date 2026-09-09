"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { resolveDestination } from "@/lib/auth";
import { passwordResetEmail, sendEmail } from "@/emails";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Forgotten-password reset, by emailed code.
 *
 * Mirrors the signup flow rather than using Supabase's own reset email: the
 * code is minted with generateLink and delivered through our templates, so
 * every outbound mail is logged in email_log and looks like the rest of them.
 *
 * Two steps, one screen each:
 *   request  → mints a recovery code and emails it
 *   complete → verifies the code, which signs them in, then sets the password
 */

export type ResetState = {
  step: "request" | "code";
  email: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Set once a code has gone out, so the screen can say so. */
  sent?: boolean;
  /** Shown when the address has no account — see the note in request(). */
  unknownEmail?: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const passwordSchema = z
  .object({
    // Same floor as signup; anything else would let reset weaken an account.
    password: z.string().min(8, "Use at least 8 characters").max(200),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Both passwords must match",
    path: ["confirm"],
  });

/** Step 1 — mint a recovery code and email it. */
export async function requestPasswordReset(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!EMAIL_RE.test(email)) {
    return { step: "request", email, fieldErrors: { email: "Enter your email address." } };
  }

  const profile = await prisma.profile.findUnique({
    where: { email },
    select: { fullName: true },
  });

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });

  if (error || !data.properties?.hashed_token) {
    // Recovery on an address with no account is the common case here, and
    // saying so is a deliberate choice: signup already reports when an
    // address is taken, so staying vague only costs a person who mistyped
    // their address twenty minutes of waiting for a code that never comes.
    //
    // Matched on code/status first — verified against Supabase as
    // { code: "user_not_found", status: 404, message: "User with this email
    // not found" }. The message is checked last only as a backstop; wording
    // is not part of anyone's API contract.
    const missing =
      error?.code === "user_not_found" ||
      error?.status === 404 ||
      (error ? /not found|no user/i.test(error.message) : false);

    if (missing) {
      return {
        step: "request",
        email,
        unknownEmail: true,
        error: "We couldn't find an account with that email address.",
      };
    }

    console.error("[reset] generateLink failed", error?.message);
    return { step: "request", email, error: "We couldn't send a reset code. Try again." };
  }

  const mail = passwordResetEmail({ name: profile?.fullName ?? null, code: data.properties.email_otp });

  await sendEmail({
    to: email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    template: "password_reset",
    // Keyed on the token, not the code: a genuine re-send always goes out,
    // a double-submitted form doesn't put two copies in one inbox, and the
    // live secret stays out of email_log. Same reasoning as signup.
    dedupeKey: `reset:${data.properties.hashed_token}`,
  });

  return { step: "code", email, sent: true };
}

/** Step 2 — verify the code and set the new password. */
export async function completePasswordReset(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  // People paste codes with spaces in them.
  const token = String(formData.get("token") ?? "").replace(/\D/g, "");
  const nextPath = sanitiseNext(String(formData.get("next") ?? ""));

  if (!email) {
    return { step: "request", email: "", error: "Start again — we lost track of your email." };
  }

  const parsed = passwordSchema.safeParse({
    password: String(formData.get("password") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });

  // Code length is a Supabase project setting, so check a sane range rather
  // than hard-coding 6 or 8 and rejecting valid codes before they're tried.
  if (token.length < 6 || token.length > 10) {
    return { step: "code", email, fieldErrors: { token: "Enter the code from your email." } };
  }

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "password");
      fieldErrors[key] ??= issue.message;
    }
    return { step: "code", email, fieldErrors };
  }

  const supabase = await createClient();

  // "recovery" rather than "email": a recovery code is what generateLink
  // minted above, and verifying it both proves the address and opens the
  // session that updateUser needs to change the password.
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "recovery" });

  if (error || !data.user) {
    return {
      step: "code",
      email,
      fieldErrors: { token: "That code isn't right, or it's expired. Try again." },
    };
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (updateError) {
    console.error("[reset] password update failed", updateError.message);
    return {
      step: "code",
      email,
      error: "We couldn't set that password. Try again.",
    };
  }

  const profile = await prisma.profile.findUnique({
    where: { id: data.user.id },
    select: { role: true },
  });

  // Redirect server-side for the same reason signup does: a resolved action
  // re-renders the current route, and /reset-password turns signed-in
  // visitors away before any client-side navigation could run.
  redirect(resolveDestination(profile?.role ?? "CUSTOMER", nextPath));
}

/** Same-origin paths only — an open redirect here would be a phishing gift. */
function sanitiseNext(next: string) {
  return next.startsWith("/") && !next.startsWith("//") ? next : "";
}
