"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle, Loader2, MailCheck } from "lucide-react";

import { AuthShell } from "@/components/auth/AuthShell";
import { Combobox, LockedField, RadioGroup, TextField } from "@/components/auth/fields";
import { DEFAULT_STATE, TAMIL_NADU_CITIES } from "@/lib/data/indianStates";
import { latestBirthDateFor } from "@/lib/dates";

/** Kept in step with MIN_AGE in the signup action. */
const MIN_SIGNUP_AGE = 18;
import {
  resendVerification,
  signUp,
  verifySignupOtp,
  type SignupState,
  type VerifyState,
} from "./actions";

const initial: SignupState = { status: "idle", email: "" };

export function SignupForm({ next }: { next: string }) {
  const [state, submit, pending] = useActionState(signUp, initial);
  const [resent, resendAction, resending] = useActionState(resendVerification, initial);

  if (state.status === "sent") {
    return <VerifyStep email={state.email} next={next} onResend={resendAction} resending={resending} resent={resent} />;
  }

  const err = state.fieldErrors ?? {};
  const val = state.values ?? {};

  return (
    <AuthShell
      wide
      title="Create your account"
      subtitle="You'll need one to book a seat. Everything here is used to plan the trip — rooming, group flights and reaching you if plans change."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium underline underline-offset-4 hover:text-navy">
            Sign in
          </Link>
        </>
      }
    >
      <form action={submit} noValidate className="flex flex-col gap-5">
        <input type="hidden" name="next" value={next} />

        {state.status === "error" && state.error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-coral/30 bg-coral/[0.07] px-3.5 py-2.5 text-[0.87rem] leading-relaxed text-navy"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-coral" />
            {state.error}
          </p>
        )}

        <Group label="About you">
          <TextField
            name="fullName"
            label="Full name"
            placeholder="As printed on your ID"
            autoComplete="name"
            defaultValue={val.fullName}
            error={err.fullName}
            className="sm:col-span-2"
          />
          <TextField
            name="dateOfBirth"
            label="Date of birth"
            type="date"
            autoComplete="bday"
            // The picker itself refuses a birthday that would make them under
            // 18 — cheaper than a round trip to be told the same thing.
            max={latestBirthDateFor(MIN_SIGNUP_AGE)}
            min="1900-01-01"
            defaultValue={val.dateOfBirth}
            error={err.dateOfBirth}
          />
          <RadioGroup
            name="gender"
            label="Gender"
            options={[
              { value: "MALE", label: "Male" },
              { value: "FEMALE", label: "Female" },
            ]}
            defaultValue={val.gender}
            error={err.gender}
          />
        </Group>

        <Group label="How we reach you">
          <TextField
            name="email"
            label="Email address"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            defaultValue={val.email ?? state.email}
            error={err.email}
          />
          <TextField
            name="phone"
            label="Phone number"
            type="tel"
            placeholder="10-digit mobile"
            autoComplete="tel"
            defaultValue={val.phone}
            error={err.phone}
          />
        </Group>

        <Group label="Where you're travelling from">
          {/* Fixed for now — every batch currently departs from Tamil Nadu,
              so this is shown for confirmation rather than as a decision. */}
          <LockedField name="state" label="State" value={DEFAULT_STATE} />
          <Combobox
            name="city"
            label="City"
            placeholder="Start typing…"
            options={TAMIL_NADU_CITIES}
            defaultValue={val.city}
            error={err.city}
          />
        </Group>

        <Group label="Security">
          <TextField
            name="password"
            label="Password"
            type="password"
            hint="At least 8 characters"
            placeholder="••••••••"
            autoComplete="new-password"
            error={err.password}
            className="sm:col-span-2"
          />
        </Group>

        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary mt-1 w-full justify-center disabled:opacity-70"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {pending ? "Creating your account…" : "Create account"}
        </button>

        <p className="text-center text-[0.78rem] leading-relaxed text-navy/45">
          By creating an account you agree to our{" "}
          <Link href="/terms-and-conditions" className="underline underline-offset-2 hover:text-navy">
            terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy-policy" className="underline underline-offset-2 hover:text-navy">
            privacy policy
          </Link>
          .
        </p>
      </form>
    </AuthShell>
  );
}

/**
 * Second step: the code from the email, entered here.
 *
 * Verifying in place rather than through a link in the email keeps the person
 * on the screen they're already on — no bounce out to an inbox, no coming
 * back to a different tab, and it works when the mail arrives on their phone
 * while they're signing up on a laptop.
 */
function VerifyStep({
  email,
  next,
  onResend,
  resending,
  resent,
}: {
  email: string;
  next: string;
  onResend: (formData: FormData) => void;
  resending: boolean;
  resent: SignupState;
}) {
  // No navigation handling here: on success the action redirects server-side,
  // so this component only ever renders the form or an error.
  const [state, verify, verifying] = useActionState(verifySignupOtp, { status: "idle" } as VerifyState);

  return (
    <AuthShell
      title="Enter your code"
      subtitle={`We've emailed a code to ${email}. It expires in an hour.`}
      footer={
        <>
          Wrong address?{" "}
          <Link href="/signup" className="font-medium underline underline-offset-4 hover:text-navy">
            Start again
          </Link>
        </>
      }
    >
      <form action={verify} className="flex flex-col gap-4">
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
          maxLength={10}
          placeholder="12345678"
          error={state.error}
          className="[&_input]:text-center [&_input]:text-lg [&_input]:tracking-[0.4em]"
        />

        <button
          type="submit"
          disabled={verifying}
          className="btn btn-primary w-full justify-center disabled:opacity-70"
        >
          {verifying && <Loader2 className="h-4 w-4 animate-spin" />}
          {verifying ? "Verifying…" : "Verify & continue"}
        </button>
      </form>

      <form action={onResend} className="mt-4 text-center">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="next" value={next} />
        <p className="text-[0.85rem] text-navy/55">
          Nothing after a minute? Check spam, or{" "}
          <button
            type="submit"
            disabled={resending}
            className="font-medium underline underline-offset-4 hover:text-navy disabled:opacity-50"
          >
            {resending ? "sending…" : "send a new code"}
          </button>
          .
        </p>
        {resent.status === "sent" && (
          <p className="mt-1.5 text-[0.85rem] font-medium text-teal">
            Sent — the newest code is the one that works.
          </p>
        )}
      </form>
    </AuthShell>
  );
}

/**
 * Eight inputs in one column is a wall. Grouping them into named sections
 * turns it into four small questions, which is the same form but a much
 * shorter-looking one.
 */
function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2.5 text-[0.72rem] font-semibold uppercase tracking-[0.11em] text-navy/40">
        {label}
      </legend>
      <div className="grid gap-3.5 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}
