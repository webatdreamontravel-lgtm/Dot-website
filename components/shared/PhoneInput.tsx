"use client";

import { PHONE_COUNTRY_CODE, PHONE_NATIONAL_DIGITS, sanitisePhoneInput } from "@/lib/phone";

/**
 * A phone field that can only hold a valid-shaped number.
 *
 * The country code sits outside the input as static text rather than inside
 * it as a value. That is the whole point: it can't be deleted, it can't be
 * typed twice, and the ten digits the field does hold are exactly what gets
 * stored — so the same number can't arrive as "8903413149" one day and
 * "+918903413149" the next.
 *
 * Non-digits are stripped as they are typed, and a pasted number carrying
 * its own +91 or leading 0 has it removed rather than being rejected. Nobody
 * should have to reformat a number they copied from WhatsApp.
 *
 * Change PHONE_COUNTRY_CODE in lib/phone.ts and every field here follows.
 */
export function PhoneInput({
  value,
  onChange,
  id,
  name,
  placeholder = "98765 43210",
  autoComplete = "tel",
  required,
  className = "",
  inputClassName = "",
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
  name?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  /** Styles the wrapper, which is what looks like the input. */
  className?: string;
  /** Styles the bare <input> inside it. */
  inputClassName?: string;
  disabled?: boolean;
}) {
  return (
    <span
      className={
        "inline-flex w-full items-center gap-1.5 " +
        (disabled ? "opacity-60 " : "") +
        className
      }
    >
      <span aria-hidden className="flex-none select-none text-current opacity-55">
        {PHONE_COUNTRY_CODE}
      </span>
      <input
        id={id}
        name={name}
        type="tel"
        inputMode="numeric"
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        // maxLength is a belt to sanitise's braces: it stops the caret moving
        // past ten even for input methods that bypass onChange.
        maxLength={PHONE_NATIONAL_DIGITS}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(sanitisePhoneInput(e.target.value))}
        // Screen readers announce the prefix, which is only rendered visually.
        aria-label={`Phone number, ${PHONE_COUNTRY_CODE}`}
        className={"w-full min-w-0 border-0 bg-transparent p-0 outline-none " + inputClassName}
      />
    </span>
  );
}
