"use client";

import { useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Form primitives for the auth screens.
 *
 * Every field carries a real <label> and binds its error with
 * aria-describedby, so a screen reader announces what's wrong with *this*
 * input rather than leaving the person to hunt. Placeholders are hints, never
 * labels — they vanish the moment you start typing.
 */

const base =
  "w-full rounded-xl border bg-white px-3.5 py-2.5 text-[0.95rem] text-navy outline-none transition placeholder:text-navy/30";

const tone = (invalid: boolean) =>
  invalid
    ? "border-coral focus:border-coral focus:ring-[3px] focus:ring-coral/15"
    : "border-navy/15 focus:border-teal focus:ring-[3px] focus:ring-teal/15";

export function TextField({
  name,
  label,
  error,
  invalid,
  hint,
  type = "text",
  className,
  prefix,
  ...rest
}: {
  name: string;
  label: string;
  error?: React.ReactNode;
  /**
   * Marks the field wrong without printing a message under it — for when the
   * explanation belongs somewhere else, like the alert at the top of a form.
   * `error` implies this; set it on its own when there is no inline text.
   */
  invalid?: boolean;
  hint?: string;
  type?: string;
  className?: string;
  /**
   * Static text pinned to the left of the input — "+91" and the like.
   *
   * Outside the value on purpose: a prefix that lives in the field can be
   * deleted, typed twice, or submitted as part of the number. This one can't
   * be any of those.
   */
  prefix?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "type" | "className">) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  // An inline message always implies the field is wrong; `invalid` covers the
  // case where the message lives elsewhere.
  const wrong = Boolean(error) || Boolean(invalid);

  return (
    <div className={className}>
      <Label htmlFor={name} label={label} hint={hint} hintId={hintId} />
      {prefix ? (
        <span className={cn(base, tone(wrong), "flex items-center gap-1.5")}>
          <span aria-hidden className="flex-none select-none opacity-55">
            {prefix}
          </span>
          <input
            id={name}
            name={name}
            type={type}
            aria-invalid={wrong}
            aria-describedby={error ? errorId : hint ? hintId : undefined}
            aria-label={`${label}, ${prefix}`}
            className="w-full min-w-0 border-0 bg-transparent p-0 outline-none"
            {...rest}
          />
        </span>
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          aria-invalid={wrong}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={cn(base, tone(wrong))}
          {...rest}
        />
      )}
      <FieldError id={errorId} error={error} />
    </div>
  );
}

export function SelectField({
  name,
  label,
  error,
  options,
  placeholder,
  className,
  defaultValue,
  value,
  onChange,
}: {
  name: string;
  label: string;
  error?: React.ReactNode;
  options: { value: string; label: string }[];
  placeholder: string;
  className?: string;
  defaultValue?: string;
  /** Pass with onChange to drive another field from this one. */
  value?: string;
  onChange?: (value: string) => void;
}) {
  const errorId = `${name}-error`;
  const controlled = value !== undefined;

  return (
    <div className={className}>
      <Label htmlFor={name} label={label} />
      <select
        id={name}
        name={name}
        {...(controlled
          ? { value, onChange: (e) => onChange?.(e.target.value) }
          : { defaultValue: defaultValue ?? "" })}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={cn(base, tone(Boolean(error)))}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <FieldError id={errorId} error={error} />
    </div>
  );
}

/**
 * A field whose value is fixed and shown for confirmation, not for editing.
 *
 * Carries a hidden input because a disabled control submits nothing — the
 * value would silently arrive empty at the server and fail validation.
 */
export function LockedField({
  name,
  label,
  value,
  note,
  className,
}: {
  name: string;
  label: string;
  value: string;
  note?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={name} label={label} hint={note} hintId={`${name}-hint`} />
      <input type="hidden" name={name} value={value} />
      <p
        id={name}
        aria-describedby={note ? `${name}-hint` : undefined}
        className="rounded-xl border border-navy/10 bg-cream-soft px-3.5 py-2.5 text-[0.95rem] text-navy/75"
      >
        {value}
      </p>
    </div>
  );
}

/**
 * Radios rather than a dropdown: with only two choices a select hides both
 * options behind a tap and costs more interactions than it saves.
 */
export function RadioGroup({
  name,
  label,
  error,
  options,
  defaultValue,
  className,
}: {
  name: string;
  label: string;
  error?: React.ReactNode;
  options: { value: string; label: string }[];
  defaultValue?: string;
  className?: string;
}) {
  const errorId = `${name}-error`;

  return (
    <fieldset className={className}>
      <legend className="mb-1.5 text-[0.83rem] font-medium text-navy/75">{label}</legend>
      <div
        role="radiogroup"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className="grid grid-cols-2 gap-2"
      >
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[0.92rem] transition",
              "has-[:checked]:border-teal has-[:checked]:bg-teal/[0.07] has-[:checked]:font-medium has-[:checked]:text-navy",
              "has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-teal/20",
              error ? "border-coral text-navy/70" : "border-navy/15 text-navy/70 hover:border-navy/30",
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              defaultChecked={defaultValue === o.value}
              className="h-4 w-4 accent-teal"
            />
            {o.label}
          </label>
        ))}
      </div>
      <FieldError id={errorId} error={error} />
    </fieldset>
  );
}

/**
 * Type-to-filter picker for a long list.
 *
 * Forty-nine cities in a plain <select> means scrolling past forty-eight
 * wrong answers to reach yours. Typing two letters gets there instead.
 *
 * Whatever is in the box is what gets submitted, so a town that isn't on the
 * list can still be typed in full rather than forcing an "Other" that tells
 * the team nothing.
 */
export function Combobox({
  name,
  label,
  options,
  placeholder,
  defaultValue,
  error,
  className,
}: {
  name: string;
  label: string;
  options: readonly string[];
  placeholder?: string;
  defaultValue?: string;
  error?: React.ReactNode;
  className?: string;
}) {
  const [query, setQuery] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const listId = `${name}-list`;
  const errorId = `${name}-error`;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    // Prefix matches first — typing "co" should surface Coimbatore before
    // anything that merely contains those letters.
    const starts = options.filter((o) => o.toLowerCase().startsWith(q));
    const contains = options.filter(
      (o) => !o.toLowerCase().startsWith(q) && o.toLowerCase().includes(q),
    );
    return [...starts, ...contains];
  }, [query, options]);

  const choose = (value: string) => {
    setQuery(value);
    setOpen(false);
    setActive(0);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open && matches[active]) {
      // Picking from the list must not also submit the form.
      e.preventDefault();
      choose(matches[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div
      className={cn("relative", className)}
      ref={wrapRef}
      onBlur={(e) => {
        // Only close when focus actually leaves the widget, or clicking an
        // option would dismiss the list before the click registers.
        if (!wrapRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <Label htmlFor={name} label={label} />
      <div className="relative">
        <input
          id={name}
          name={name}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && matches[active] ? `${name}-opt-${active}` : undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className={cn(base, tone(Boolean(error)), "pr-9")}
        />
        <Search
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/30"
        />
      </div>

      {open && matches.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-navy/12 bg-white py-1 shadow-lg"
        >
          {matches.map((o, i) => (
            <li key={o} id={`${name}-opt-${i}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                // onMouseDown, not onClick: mousedown fires before blur, so
                // the option is chosen instead of the list closing first.
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(o);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "block w-full px-3.5 py-2 text-left text-[0.92rem] transition",
                  i === active ? "bg-teal/10 text-navy" : "text-navy/75",
                )}
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && matches.length === 0 && query.trim() && (
        <p className="absolute z-20 mt-1 w-full rounded-xl border border-navy/12 bg-white px-3.5 py-2.5 text-[0.87rem] text-navy/50 shadow-lg">
          Not on the list — we&apos;ll take what you&apos;ve typed.
        </p>
      )}

      <FieldError id={errorId} error={error} />
    </div>
  );
}

function Label({
  htmlFor,
  label,
  hint,
  hintId,
}: {
  htmlFor: string;
  label: string;
  hint?: string;
  hintId?: string;
}) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-3">
      <label htmlFor={htmlFor} className="text-[0.83rem] font-medium text-navy/75">
        {label}
      </label>
      {hint && (
        <span id={hintId} className="text-[0.73rem] text-navy/40">
          {hint}
        </span>
      )}
    </div>
  );
}

function FieldError({ id, error }: { id: string; error?: React.ReactNode }) {
  if (!error) return null;
  return (
    <p id={id} className="mt-1 text-[0.78rem] font-medium text-coral">
      {error}
    </p>
  );
}
