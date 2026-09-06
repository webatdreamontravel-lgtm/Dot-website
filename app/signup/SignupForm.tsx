"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { AlertCircle, Loader2, MailCheck } from "lucide-react";

import { AuthShell } from "@/components/auth/AuthShell";
import { Combobox, LockedField, RadioGroup, TextField } from "@/components/auth/fields";
import { ResendCodeButton } from "@/components/auth/ResendCodeButton";
import { DEFAULT_STATE, TAMIL_NADU_CITIES } from "@/lib/data/indianStates";
import { latestBirthDateFor } from "@/lib/dates";
import {
  PHONE_COUNTRY_CODE,
  PHONE_NATIONAL_DIGITS,
  sanitisePhoneInput,
} from "@/lib/phone";

/** Kept in step with MIN_AGE in the signup action. */
const MIN_SIGNUP_AGE = 18;
import {
  checkEmailAvailability,
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

  const [emailTaken, setEmailTaken] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  // Blur can fire faster than the lookups resolve. Only the newest answer is
  // allowed to win, or a slow reply about an old address overwrites a fast
  // one about the address actually in the box.
  const checkSeq = useRef(0);

  async function checkEmail(e: React.FocusEvent<HTMLInputElement>) {
    const value = e.currentTarget.value.trim();
    setEmailTaken(false);
    if (!value) return;

    const seq = ++checkSeq.current;
    setCheckingEmail(true);
    try {
      const { taken } = await checkEmailAvailability(value);
      if (seq === checkSeq.current) setEmailTaken(taken);
    } catch {
      // Advisory only. A failed check must never look like a taken address,
      // and must never stand between someone and an account — signUp()
      // re-checks server-side anyway.
    } finally {
      if (seq === checkSeq.current) setCheckingEmail(false);
    }
  }

  if (state.status === "sent") {
    return <VerifyStep email={state.email} next={next} onResend={resendAction} resending={resending} resent={resent} />;
  }

  const err = state.fieldErrors ?? {};
  const val = state.values ?? {};

  // One alert at the top of the form carries the whole explanation; the email
  // input is only tinted. A message sitting under a field two thirds of the
  // way down a long form is easy to scroll past, and this one has the links
  // out of the dead end in it.
  //
  // A server error wins over the live check: it is the newer, authoritative
  // answer, and it may be about something else entirely.
  const serverError = state.status === "error" ? state.error : undefined;
  const topError =
    serverError ?? (emailTaken ? "An account already exists with this email address." : undefined);
  const showAccountLinks = Boolean(state.existingAccount || (!serverError && emailTaken));

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

        {topError && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-coral/30 bg-coral/[0.07] px-3.5 py-2.5 text-[0.87rem] leading-relaxed text-navy"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-coral" />
            <span>
              {topError}
              {/* The whole point of naming the collision is giving them the
                  way out of it, so the links go in the message itself. */}
              {showAccountLinks && (
                <>
                  {" "}
                  <Link
                    href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
                    className="font-medium underline underline-offset-4 hover:text-navy"
                  >
                    Sign in
                  </Link>{" "}
                  instead, or{" "}
                  <Link
                    href="/reset-password"
                    className="font-medium underline underline-offset-4 hover:text-navy"
                  >
                    reset your password
                  </Link>
                  .
                </>
              )}
            </span>
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
            name="email"
            label="Email address"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            defaultValue={val.email ?? state.email}
            // Checked as soon as they leave the field, not on submit.
            onBlur={checkEmail}
            // Any edit invalidates the previous answer, so the stale "already
            // taken" doesn't sit under an address they've since corrected.
            onInput={() => setEmailTaken(false)}
            hint={checkingEmail ? "Checking…" : undefined}
            error={err.email}
            // Tinted, but silent: the explanation is in the alert at the top.
            invalid={emailTaken}
          />
          <TextField
            name="phone"
            label="Phone number"
            type="tel"
            inputMode="numeric"
            prefix={PHONE_COUNTRY_CODE}
            maxLength={PHONE_NATIONAL_DIGITS}
            placeholder="98765 43210"
            autoComplete="tel"
            defaultValue={val.phone}
            error={err.phone}
            // Uncontrolled, so the strip happens on the element itself.
            onInput={(e) => {
              const el = e.currentTarget;
              el.value = sanitisePhoneInput(el.value);
            }}
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
          // Blocked while the address is known to be taken. Safe to gate on
          // because emailTaken is cleared the moment the field is edited — so
          // correcting the address re-enables the button immediately, and a
          // stale "taken" can never leave someone stuck with no way forward.
          disabled={pending || emailTaken}
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
          <ResendCodeButton
            pending={resending}
            className="font-medium underline underline-offset-4 hover:text-navy disabled:no-underline disabled:opacity-50"
          />
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
      <legend className="mb-2.5 text-[0.75rem] font-semibold uppercase tracking-[0.11em] text-navy/40">
        {label}
      </legend>
      <div className="grid gap-3.5 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}
