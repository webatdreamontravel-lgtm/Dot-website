"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle, KeyRound, Loader2, MailCheck } from "lucide-react";

import { AuthShell } from "@/components/auth/AuthShell";
import { TextField } from "@/components/auth/fields";
import { ResendCodeButton } from "@/components/auth/ResendCodeButton";

import {
  completePasswordReset,
  requestPasswordReset,
  type ResetState,
} from "./actions";

const initial: ResetState = { step: "request", email: "" };

export function ResetPasswordForm({ next }: { next: string }) {
  const [state, request, requesting] = useActionState(requestPasswordReset, initial);

  if (state.step === "code") {
    return <CodeStep email={state.email} next={next} onResend={request} resending={requesting} />;
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Tell us the email on your account and we'll send a code to set a new password."
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="font-medium underline underline-offset-4 hover:text-navy">
            Sign in
          </Link>
        </>
      }
    >
      <form action={request} noValidate className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />

        {state.error && !state.fieldErrors?.email && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-coral/30 bg-coral/[0.07] px-3.5 py-2.5 text-[0.87rem] leading-relaxed text-navy"
          >
            <AlertCircle className="mt-[3px] h-4 w-4 flex-none text-coral" />
            <span>
              {state.error}
              {state.unknownEmail && (
                <>
                  {" "}
                  <Link
                    href="/signup"
                    className="font-medium underline underline-offset-4 hover:text-navy"
                  >
                    Create one instead
                  </Link>
                  .
                </>
              )}
            </span>
          </p>
        )}

        <div className="mb-1 flex justify-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-teal/10">
            <KeyRound className="h-6 w-6 text-teal" />
          </span>
        </div>

        <TextField
          name="email"
          label="Email address"
          type="email"
          autoComplete="email"
          autoFocus
          defaultValue={state.email}
          error={state.fieldErrors?.email}
        />

        <button
          type="submit"
          disabled={requesting}
          className="btn btn-primary mt-1 w-full justify-center disabled:opacity-70"
        >
          {requesting && <Loader2 className="h-4 w-4 animate-spin" />}
          {requesting ? "Sending…" : "Send reset code"}
        </button>
      </form>
    </AuthShell>
  );
}

/**
 * Code plus new password on one screen.
 *
 * Kept together rather than split into "verify, then choose": the code opens
 * a session, and leaving someone mid-reset with a live session and no new
 * password is a worse place to abandon the flow than the start.
 */
function CodeStep({
  email,
  next,
  onResend,
  resending,
}: {
  email: string;
  next: string;
  onResend: (formData: FormData) => void;
  resending: boolean;
}) {
  // On success the action redirects server-side, so this only ever renders
  // the form or an error.
  const [state, complete, saving] = useActionState(completePasswordReset, {
    step: "code",
    email,
  } as ResetState);

  return (
    <AuthShell
      title="Choose a new password"
      subtitle={`We've emailed a code to ${email}. It expires in an hour.`}
      footer={
        <>
          Wrong address?{" "}
          <Link
            href="/reset-password"
            className="font-medium underline underline-offset-4 hover:text-navy"
          >
            Start again
          </Link>
        </>
      }
    >
      <form action={complete} noValidate className="flex flex-col gap-4">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="next" value={next} />

        {state.error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-coral/30 bg-coral/[0.07] px-3.5 py-2.5 text-[0.87rem] leading-relaxed text-navy"
          >
            <AlertCircle className="mt-[3px] h-4 w-4 flex-none text-coral" />
            {state.error}
          </p>
        )}

        <div className="mb-1 flex justify-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-teal/10">
            <MailCheck className="h-6 w-6 text-teal" />
          </span>
        </div>

        <TextField
          name="token"
          label="Reset code"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={10}
          placeholder="12345678"
          error={state.fieldErrors?.token}
          className="[&_input]:text-center [&_input]:text-lg [&_input]:tracking-[0.4em]"
        />

        <TextField
          name="password"
          label="New password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters."
          error={state.fieldErrors?.password}
        />

        <TextField
          name="confirm"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          error={state.fieldErrors?.confirm}
        />

        <button
          type="submit"
          disabled={saving}
          className="btn btn-primary mt-1 w-full justify-center disabled:opacity-70"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? "Saving…" : "Set new password"}
        </button>
      </form>

      <form action={onResend} className="mt-4 text-center">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="next" value={next} />
        <p className="text-[0.85rem] text-navy/55">
          Nothing after a minute? Check spam, or{" "}
          <ResendCodeButton
            pending={resending}
            className="font-medium underline underline-offset-4 hover:text-navy disabled:no-underline disabled:opacity-50"
          />
          .
        </p>
      </form>
    </AuthShell>
  );
}
