"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, Loader2, MailCheck } from "lucide-react";

import { AuthShell } from "@/components/auth/AuthShell";
import { TextField } from "@/components/auth/fields";
import { ResendCodeButton } from "@/components/auth/ResendCodeButton";
import { cn } from "@/lib/utils";
import {
  sendSignInCode,
  signInWithPassword,
  verifySignInCode,
  type LoginState,
} from "./actions";

const initial: LoginState = { email: "" };

/** Password, or a one-time code emailed to the address on the account. */
type Method = "password" | "code";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [method, setMethod] = useState<Method>("password");

  const [pwState, submitPassword, signingIn] = useActionState(signInWithPassword, initial);
  const [codeState, requestCode, sendingCode] = useActionState(sendSignInCode, initial);
  const [verifyState, verifyCode, verifying] = useActionState(verifySignInCode, initial);

  // A confirmation link that's expired or already used lands back here, and
  // the reason has to be visible or it just looks like sign-in is broken.
  const linkError = useSearchParams().get("error");
  const linkMessage =
    linkError === "link-expired"
      ? "That confirmation link has expired or was already used. Sign in below, or create your account again for a fresh one."
      : linkError === "link-invalid"
        ? "That link didn't look right. Try signing in below."
        : null;

  // Both routes end the same way — the action reports "ok" with a destination
  // the server resolved from the account's role — so one effect covers them.
  const signedIn = pwState.message === "ok" ? pwState : verifyState.message === "ok" ? verifyState : null;

  useEffect(() => {
    if (!signedIn) return;

    // Admins land on the panel, everyone else back on the site. `next` is
    // only the fallback.
    router.replace(signedIn.redirectTo || next || "/");
    router.refresh();
  }, [signedIn, next, router]);

  const signupHref = next ? `/signup?next=${encodeURIComponent(next)}` : "/signup";

  // Once a code is out, the email step is done — swap to the code entry
  // rather than leaving them looking at the form they just submitted.
  const awaitingCode = method === "code" && codeState.codeSent;

  return (
    <AuthShell
      title="Welcome back"
      subtitle={
        awaitingCode
          ? `We've emailed a code to ${codeState.email}. It expires in an hour.`
          : "Sign in to see your trips and bookings."
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

      {/* Hidden once a code is out: at that point they are mid-flow, and a
          switcher there just invites losing the code they were sent. The
          back link under the form is the way out instead. */}
      {!awaitingCode && <MethodTabs method={method} onChange={setMethod} />}

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

          <div className="-mt-1.5 text-right">
            <Link
              href={next ? `/reset-password?next=${encodeURIComponent(next)}` : "/reset-password"}
              className="text-[0.83rem] font-medium text-navy/60 underline underline-offset-4 hover:text-navy"
            >
              Forgot your password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={signingIn}
            className="btn btn-primary mt-1 w-full justify-center disabled:opacity-70"
          >
            {signingIn && <Loader2 className="h-4 w-4 animate-spin" />}
            {signingIn ? "Signing in…" : "Sign in"}
          </button>
        </form>
      ) : awaitingCode ? (
        <>
          <form action={verifyCode} className="flex flex-col gap-4">
            {/* The address travels with the request: the code step has no
                email input, and the action needs it to verify against. */}
            <input type="hidden" name="email" value={codeState.email} />
            <input type="hidden" name="next" value={next} />

            <div className="mb-1 flex justify-center">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-teal/10">
                <MailCheck className="h-6 w-6 text-teal" />
              </span>
            </div>

            <TextField
              name="token"
              label="Sign-in code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={10}
              placeholder="12345678"
              error={verifyState.error}
              className="[&_input]:text-center [&_input]:text-lg [&_input]:tracking-[0.4em]"
            />

            <button
              type="submit"
              disabled={verifying}
              className="btn btn-primary w-full justify-center disabled:opacity-70"
            >
              {verifying && <Loader2 className="h-4 w-4 animate-spin" />}
              {verifying ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <form action={requestCode} className="mt-4 text-center">
            <input type="hidden" name="email" value={codeState.email} />
            <p className="text-[0.85rem] text-navy/55">
              Nothing after a minute? Check spam, or{" "}
              <ResendCodeButton
                pending={sendingCode}
                className="font-medium underline underline-offset-4 hover:text-navy disabled:no-underline disabled:opacity-50"
              />
              .
            </p>
          </form>

          <BackToPassword onClick={() => setMethod("password")} />
        </>
      ) : (
        <form action={requestCode} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />

          {codeState.error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-coral/30 bg-coral/[0.07] px-3.5 py-2.5 text-[0.87rem] leading-relaxed text-navy"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-coral" />
              <span>
                {codeState.error}
                {codeState.unknownEmail && (
                  <>
                    {" "}
                    <Link
                      href={signupHref}
                      className="font-medium underline underline-offset-4 hover:text-navy"
                    >
                      Create an account
                    </Link>
                    .
                  </>
                )}
              </span>
            </p>
          )}

          <TextField
            name="email"
            label="Email address"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="you@example.com"
            defaultValue={codeState.email}
          />

          <button
            type="submit"
            disabled={sendingCode}
            className="btn btn-primary mt-1 w-full justify-center disabled:opacity-70"
          >
            {sendingCode && <Loader2 className="h-4 w-4 animate-spin" />}
            {sendingCode ? "Sending…" : "Email me a code"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

/**
 * Picks how to sign in, above the form rather than as a link under it.
 *
 * Borrows the segmented pill from AccountToolbar rather than the admin Tabs
 * strip: this is a customer screen, and that component already uses the
 * navy/cream tokens AuthShell is built from. The admin strip is grey-on-teal
 * and belongs to the panel's visual language, not this one.
 *
 * `tablist`/`tab` rather than `group`/`aria-pressed`, because these swap the
 * panel below them — which is what a screen reader needs to be told here, and
 * what the filter pills in AccountToolbar are not doing.
 */
function MethodTabs({
  method,
  onChange,
}: {
  method: Method;
  onChange: (m: Method) => void;
}) {
  const tabs: { value: Method; label: string }[] = [
    { value: "password", label: "Email & password" },
    { value: "code", label: "One-time code" },
  ];

  return (
    <div
      role="tablist"
      aria-label="Sign-in method"
      className="mb-5 flex gap-1 rounded-2xl border border-navy/12 bg-cream p-1 sm:rounded-full"
    >
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={method === t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            "min-h-[40px] flex-1 whitespace-nowrap rounded-full px-4 py-2 text-[0.85rem] font-medium transition",
            method === t.value
              ? "bg-navy text-cream"
              : "text-navy/60 hover:bg-navy/5 hover:text-navy",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function BackToPassword({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-5 inline-flex w-full items-center justify-center gap-1.5 text-[0.85rem] font-medium text-navy/60 underline underline-offset-4 hover:text-navy"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Sign in with a password instead
    </button>
  );
}
