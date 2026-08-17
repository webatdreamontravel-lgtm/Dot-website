"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";

import { AuthShell } from "@/components/auth/AuthShell";
import { TextField } from "@/components/auth/fields";
import { sendOtp, signInWithPassword, verifyOtp, type LoginState } from "./actions";

const initial: LoginState = { step: "password", email: "" };

type Method = "password" | "otp";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [method, setMethod] = useState<Method>("password");

  const [pwState, submitPassword, signingIn] = useActionState(signInWithPassword, initial);
  const [emailState, submitEmail, sendingCode] = useActionState(sendOtp, initial);
  const [otpState, submitOtp, verifying] = useActionState(verifyOtp, initial);

  const codeSent = emailState.step === "otp";
  const email = pwState.email || emailState.email || otpState.email;

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
    const done = pwState.message === "ok" ? pwState : otpState.message === "ok" ? otpState : null;
    if (!done) return;

    // The server resolved this from the signed-in user's role: admins land on
    // the panel, everyone else back on the site. `next` is only the fallback.
    router.replace(done.redirectTo || next || "/");
    router.refresh();
  }, [pwState, otpState, next, router]);

  const signupHref = next ? `/signup?next=${encodeURIComponent(next)}` : "/signup";

  // ── Code sent: a single-purpose screen, nothing else competing ──
  if (codeSent) {
    return (
      <AuthShell title="Check your email" subtitle={emailState.message}>
        <form action={submitOtp} className="flex flex-col gap-4">
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="next" value={next} />

          <div className="mb-1 flex justify-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-teal/10">
              <MailCheck className="h-6 w-6 text-teal" />
            </span>
          </div>

          <TextField
            name="token"
            label="Verification code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="Paste the code"
            error={otpState.error}
          />

          <button
            type="submit"
            disabled={verifying}
            className="btn btn-primary w-full justify-center disabled:opacity-70"
          >
            {verifying && <Loader2 className="h-4 w-4 animate-spin" />}
            {verifying ? "Verifying…" : "Verify & continue"}
          </button>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center gap-1.5 text-[0.85rem] text-navy/55 underline underline-offset-4 hover:text-navy"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Use a different email
          </button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle={
        method === "password"
          ? "Sign in to see your trips and bookings."
          : "We'll email you a code — no password needed."
      }
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

      {method === "password" ? (
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

          <Divider />

          <button
            type="button"
            onClick={() => setMethod("otp")}
            className="text-[0.87rem] font-medium text-navy/65 underline underline-offset-4 hover:text-navy"
          >
            Email me a code instead
          </button>
        </form>
      ) : (
        <form action={submitEmail} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />

          <TextField
            name="email"
            label="Email address"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="you@example.com"
            defaultValue={emailState.email}
            error={emailState.error}
          />

          <button
            type="submit"
            disabled={sendingCode}
            className="btn btn-primary mt-1 w-full justify-center disabled:opacity-70"
          >
            {sendingCode && <Loader2 className="h-4 w-4 animate-spin" />}
            {sendingCode ? "Sending…" : "Email me a code"}
          </button>

          <Divider />

          <button
            type="button"
            onClick={() => setMethod("password")}
            className="text-[0.87rem] font-medium text-navy/65 underline underline-offset-4 hover:text-navy"
          >
            Use my password instead
          </button>
        </form>
      )}
    </AuthShell>
  );
}

function Divider() {
  return (
    <div className="my-1 flex items-center gap-3" aria-hidden>
      <span className="h-px flex-1 bg-navy/10" />
      <span className="text-[0.72rem] uppercase tracking-[0.1em] text-navy/35">or</span>
      <span className="h-px flex-1 bg-navy/10" />
    </div>
  );
}
