"use server";

import { redirect } from "next/navigation";

import { resolveDestination } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  step: "password" | "email" | "otp";
  email: string;
  error?: string;
  message?: string;
  /** Where to send them once signed in. Resolved server-side from their role. */
  redirectTo?: string;
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
    return { step: "password", email, error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Deliberately vague: saying "no such user" would let anyone enumerate
    // which email addresses have accounts.
    return { step: "password", email, error: "Email or password is incorrect." };
  }

  const redirectTo = await landingFor(data.user.id, String(formData.get("next") ?? "") || null);
  return { step: "password", email, message: "ok", redirectTo };
}

/** Sends a one-time code, for customers who have no password. */
export async function sendOtp(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!EMAIL_RE.test(email)) {
    return { step: "email", email, error: "That doesn't look like an email address." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });

  if (error) {
    return { step: "email", email, error: error.message };
  }

  return { step: "otp", email, message: `We sent a verification code to ${email}.` };
}

export async function verifyOtp(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const token = String(formData.get("token") ?? "").replace(/\D/g, "");

  // Supabase's OTP length is a project setting (6 by default, but this
  // project issues 8). Don't hard-code it — validate a sane range instead,
  // or a correct code gets rejected before it ever reaches Supabase.
  if (token.length < 6 || token.length > 10) {
    return { step: "otp", email, error: "Enter the code from your email." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });

  if (error || !data.user) {
    return { step: "otp", email, error: "That code isn't right, or it expired. Try again." };
  }

  const redirectTo = await landingFor(data.user.id, String(formData.get("next") ?? "") || null);
  return { step: "otp", email, message: "ok", redirectTo };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Without this the cookie is cleared but the browser keeps showing the
  // cached admin page, which reads as "sign out is broken".
  redirect("/login");
}
