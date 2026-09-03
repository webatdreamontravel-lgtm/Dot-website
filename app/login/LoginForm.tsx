"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { AuthShell } from "@/components/auth/AuthShell";
import { TextField } from "@/components/auth/fields";
import { signInWithPassword, type LoginState } from "./actions";

const initial: LoginState = { email: "" };

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();

  const [pwState, submitPassword, signingIn] = useActionState(signInWithPassword, initial);

  // A confirmation link that's expired or already used lands back here, and
  // the reason has to be visible or it just looks like sign-in is broken.
  const linkError = useSearchParams().get("error");
  const linkMessage =
    linkError === "link-expired"
      ? "That confirmation link has expired or was already used. Sign in below, or create your account again for a fresh one."
      : linkError === "link-invalid"
        ? "That link didn't look right. Try signing in below."
        : null;

  useEffect(() => {
    if (pwState.message !== "ok") return;

    // The server resolved this from the signed-in user's role: admins land on
    // the panel, everyone else back on the site. `next` is only the fallback.
    router.replace(pwState.redirectTo || next || "/");
    router.refresh();
  }, [pwState, next, router]);

  const signupHref = next ? `/signup?next=${encodeURIComponent(next)}` : "/signup";

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to see your trips and bookings."
      footer={
        <>
          New here?{" "}
          <Link href={signupHref} className="font-medium underline underline-offset-4 hover:text-navy">
            Create an account
          </Link>
        </>
      }
    >
      {linkMessage && (
        <p
          role="alert"
          className="mb-5 rounded-xl border border-yellow/40 bg-yellow/10 px-4 py-3 text-[0.85rem] leading-relaxed text-navy"
        >
          {linkMessage}
        </p>
      )}

      <form action={submitPassword} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />

        <TextField
          name="email"
          label="Email address"
          type="email"
          autoComplete="email"
          autoFocus
          placeholder="you@example.com"
          defaultValue={pwState.email}
        />
        <TextField
          name="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          error={pwState.error}
        />

        <button
          type="submit"
          disabled={signingIn}
          className="btn btn-primary mt-1 w-full justify-center disabled:opacity-70"
        >
          {signingIn && <Loader2 className="h-4 w-4 animate-spin" />}
          {signingIn ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthShell>
  );
}
