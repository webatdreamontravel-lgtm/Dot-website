"use server";

import { redirect } from "next/navigation";

import { resolveDestination } from "@/lib/auth";
import { sendEmail, signInCodeEmail } from "@/emails";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  email: string;
  error?: string;
  message?: string;
  /** Where to send them once signed in. Resolved server-side from their role. */
  redirectTo?: string;
  /** Set once a sign-in code has gone out, so the form swaps to the code step. */
  codeSent?: boolean;
  /** Renders a "create an account" link beside the error. */
  unknownEmail?: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Resolves the landing page for a freshly signed-in user.
 *
 * Looked up from the user id the auth call just returned rather than from
 * the session cookie, so it doesn't depend on the cookie being readable
 * again within the same request.
 */
async function landingFor(userId: string, requested: string | null) {
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  return resolveDestination(profile?.role ?? "CUSTOMER", requested);
}

/**
 * Password sign-in.
 *
 * Kept as a real Supabase credential rather than a hardcoded check in this
 * file — a literal in source would sit in git history forever and would
 * work against production too. Rotate or delete the account with
 * `npm run make-admin` before launch.
 */
export async function signInWithPassword(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!EMAIL_RE.test(email) || !password) {
    return { email, error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Deliberately vague: saying "no such user" would let anyone enumerate
    // which email addresses have accounts.
    return { email, error: "Email or password is incorrect." };
  }

  const redirectTo = await landingFor(data.user.id, String(formData.get("next") ?? "") || null);
  return { email, message: "ok", redirectTo };
}

/**
 * Emails a one-time code so someone can sign in without a password.
 *
 * Built on generateLink + our own template rather than signInWithOtp, which
 * is how the first version of this worked and why it was worth replacing:
 *
 *   * signInWithOtp({ shouldCreateUser: true }) CREATED an account for any
 *     address typed into the login form. That bypassed the signup form
 *     entirely — no name, phone, date of birth, city, and no 18+ check — and
 *     left auth.users rows with empty profiles behind them.
 *   * It sent through Supabase's own mailer, so the message never reached
 *     email_log, ignored our branding, and took no notice of EMAIL_PROVIDER.
 *
 * generateLink mints the code without sending anything, so delivery goes
 * through sendEmail like every other message the app produces, and an address
 * with no account gets told so instead of silently acquiring one.
 */
export async function sendSignInCode(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!EMAIL_RE.test(email)) {
    return { email, error: "That doesn't look like an email address." };
  }

  // MUST come before generateLink. `type: "magiclink"` CREATES the user when
  // the address is unknown — it does not error the way "recovery" does — so
  // calling it first would let anyone mint an account from the login form by
  // typing an address, with no name, phone, date of birth or age check, and
  // an empty profile row behind it. Verified against Supabase: an unknown
  // address took auth.users from 7 to 8 with no error returned.
  const [account] = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM auth.users WHERE email = ${email}`;

  if (!account) {
    return {
      email,
      unknownEmail: true,
      error: "We couldn't find an account with that email address.",
    };
  }

  const profile = await prisma.profile.findUnique({
    where: { email },
    select: { fullName: true },
  });

  const admin = createAdminClient();
  // "magiclink" rather than "signup": the account exists by now, and this
  // mints a code that verifyOtp accepts as type "email".
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });

  if (error || !data.properties?.hashed_token) {
    // Never hand a raw provider message to the browser.
    console.error("[login] generateLink failed", error?.message);
    return { email, error: "We couldn't send a code. Try again." };
  }

  const mail = signInCodeEmail({
    name: profile?.fullName ?? null,
    code: data.properties.email_otp,
  });

  await sendEmail({
    to: email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    template: "login_code",
    // Keyed on the token, not the code: a genuine re-send always goes out, a
    // double-submitted form doesn't put two copies in one inbox, and the live
    // secret stays out of email_log. Same reasoning as signup.
    dedupeKey: `login:${data.properties.hashed_token}`,
  });

  return { email, codeSent: true, message: `We sent a sign-in code to ${email}.` };
}

/** Checks the emailed code and signs them in. */
export async function verifySignInCode(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  // People paste codes with spaces in them.
  const token = String(formData.get("token") ?? "").replace(/\D/g, "");

  if (!EMAIL_RE.test(email)) {
    return { email, error: "Start again — we lost track of your email." };
  }

  // Supabase's code length is a project setting (6 by default, this project
  // issues 8). Don't hard-code it, or a valid code is rejected before it is
  // ever sent for verification.
  if (token.length < 6 || token.length > 10) {
    return { email, codeSent: true, error: "Enter the code from your email." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });

  if (error || !data.user) {
    return { email, codeSent: true, error: "That code isn't right, or it expired. Try again." };
  }

  const redirectTo = await landingFor(data.user.id, String(formData.get("next") ?? "") || null);
  return { email, codeSent: true, message: "ok", redirectTo };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Without this the cookie is cleared but the browser keeps showing the
  // cached admin page, which reads as "sign out is broken".
  redirect("/login");
}
