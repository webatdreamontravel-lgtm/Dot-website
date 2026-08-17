import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { resolveDestination } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

/**
 * Lands the confirmation link from the verification email.
 *
 * verifyOtp() both marks auth.users.email_confirmed_at and establishes the
 * session, so someone who clicks the link is signed in and can carry on
 * with whatever they were doing when they signed up.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = (searchParams.get("type") ?? "email") as EmailOtpType;
  const next = searchParams.get("next");

  if (!tokenHash) {
    redirect("/login?error=link-invalid");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error || !data.user) {
    // Expired and already-used land here too — the sign-in page offers a
    // fresh link rather than leaving them on a dead end.
    redirect("/login?error=link-expired");
  }

  const profile = await prisma.profile.findUnique({
    where: { id: data.user.id },
    select: { role: true },
  });

  // Same rule as signing in, so the two can't disagree about where someone
  // belongs: a page they were genuinely part-way through wins, otherwise
  // their role decides.
  redirect(resolveDestination(profile?.role ?? "CUSTOMER", next));
}
