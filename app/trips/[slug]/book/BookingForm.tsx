"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, Check, Loader2, Minus, Plus } from "lucide-react";

import type { BookableTrip } from "@/lib/queries/booking";
import {
  computeConvenienceFee,
  computePricing,
  formatFeeRate,
  MAX_SEATS_PER_BOOKING,
  toRupees,
} from "@/lib/booking/pricing";
import { cn, formatDateRange, formatINR } from "@/lib/utils";
import { PHONE_COUNTRY_CODE, sanitisePhoneInput } from "@/lib/phone";
import { createBookingRequest } from "./actions";
import { startPayment } from "./payActions";
import { useRazorpayCheckout } from "@/components/booking/RazorpayCheckout";

type Traveller = { fullName: string; phone: string; email: string };

type Customer = { fullName: string | null; email: string; phone: string | null };

const blank = (): Traveller => ({ fullName: "", phone: "", email: "" });

/** The gateway's cut, passed down from the server so it can't be guessed. */
type FeeConfig = { rateBp: number; label: string } | null;

export function BookingForm({
  trip,
  customer,
  fee,
}: {
  trip: BookableTrip;
  customer: Customer;
  fee: FeeConfig;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const checkout = useRazorpayCheckout();

  // Whether this trip takes money online at all. Everything below branches on
  // it: same form, same validation, two different last steps.
  const payOnline = trip.razorpayEnabled;

  const maxSeats = Math.min(trip.seatsAvailable, MAX_SEATS_PER_BOOKING);

  const [step, setStep] = useState<1 | 2>(1);
  const [seats, setSeats] = useState(1);
  const [travellers, setTravellers] = useState<Traveller[]>(() => [
    // The person booking is almost always travelling, so seat one starts
    // filled in from their account rather than blank.
    { fullName: customer.fullName ?? "", phone: customer.phone ?? "", email: customer.email },
  ]);
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const price = useMemo(() => computePricing(trip, seats), [trip, seats]);

  // What Razorpay will actually charge: the advance when the trip has one,
  // otherwise the whole thing. Mirrors createPaymentOrder — the server
  // re-derives this and refuses a mismatch, so the two must agree.
  /**
   * Whether to settle the advance or the whole trip now.
   *
   * Only offered when there is a genuine choice — an advance that is set, and
   * a balance left after it. Defaults to the advance because it is the lower
   * bar, but someone who would rather be done with it shouldn't be forced
   * into a second payment weeks later.
   *
   * The server re-derives the amount from this; it never takes a figure from
   * the browser.
   */
  const canChoose = price.advanceDuePaise > 0 && price.balancePaise > 0;
  const [payMode, setPayMode] = useState<"ADVANCE" | "FULL">("ADVANCE");
  const payFull = !canChoose || payMode === "FULL";
  const bookingNowPaise = payFull ? price.totalPaise : price.advanceDuePaise;

  /**
   * The convenience fee, on the amount being charged now.
   *
   * Computed with the same function the server uses and the rate it handed
   * down, so the figure on the button is exactly what Razorpay will charge.
   * Only applies to online payment — a trip the team collects by hand never
   * shows one.
   */
  const feeRateBp = payOnline && fee ? fee.rateBp : 0;
  const charge = computeConvenienceFee(bookingNowPaise, feeRateBp);
  const payNowPaise = charge.grossPaise;

  // Jump to the first problem after the errors have actually rendered — with
  // three travellers on screen the bad field is often below the fold.
  useEffect(() => {
    if (Object.keys(fieldErrors).length === 0) return;
    const first = document.querySelector<HTMLElement>('input[aria-invalid="true"]');
    first?.scrollIntoView({ block: "center", behavior: "smooth" });
    first?.focus({ preventScroll: true });
  }, [fieldErrors]);

  const setSeatCount = (next: number) => {
    const n = Math.min(Math.max(next, 1), maxSeats);
    setSeats(n);
    setTravellers((prev) => {
      if (n === prev.length) return prev;
      // Growing keeps what's already typed; shrinking drops from the end.
      return n > prev.length
        ? [...prev, ...Array.from({ length: n - prev.length }, blank)]
        : prev.slice(0, n);
    });
  };

  const patchTraveller = (i: number, changes: Partial<Traveller>) =>
    setTravellers((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...changes } : t)));

  const goToReview = () => {
    // Mirrors the zod schema on the server. Checked here too so the customer
    // is told which field is wrong, rather than getting one error back after
    // a round trip.
    const errs: Record<string, string> = {};
    travellers.forEach((t, i) => {
      if (t.fullName.trim().length < 2) errs[`${i}.fullName`] = "Full name is required";

      const digits = t.phone.replace(/\D/g, "");
      if (!t.phone.trim()) errs[`${i}.phone`] = "Phone number is required";
      else if (digits.length < 10 || digits.length > 15) errs[`${i}.phone`] = "Enter a valid phone number";

      if (!t.email.trim()) errs[`${i}.email`] = "Email is required";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t.email.trim())) {
        errs[`${i}.email`] = "Enter a valid email address";
      }
    });
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setError(null);
    setStep(2);
    // Step 2 renders above the fold; without this the page stays scrolled
    // to wherever the last traveller field was.
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await createBookingRequest({
        slug: trip.slug,
        seats,
        travellers: travellers.map((t) => ({
          fullName: t.fullName.trim(),
          phone: t.phone.trim(),
          email: t.email.trim(),
        })),
        emergencyContactName: emergencyName.trim(),
        emergencyContactPhone: emergencyPhone.trim(),
        notes: notes.trim(),
      });

      if (result.ok) {
        router.push(`/account/bookings/${result.reference}?new=1`);
        return;
      }

      setError(result.error);
      if (result.code === "SEATS_GONE" || result.code === "NOT_BOOKABLE") {
        // The seat count on screen is now a lie — send them back to fix it.
        setStep(1);
        router.refresh();
      }
      if (result.code === "SIGNED_OUT") {
        router.push(`/login?next=/trips/${trip.slug}/book`);
      }
    });
  };

  /**
   * The paid path: reserve the seats, get an order, hand off to Razorpay.
   *
   * On success the browser tells us so and we route to the booking — but the
   * webhook is what actually confirms it, so if this call fails after a real
   * payment the customer is not left stranded: the booking still lands, just
   * a moment later.
   */
  const payAndBook = () => {
    setError(null);
    startTransition(async () => {
      const order = await startPayment({
        slug: trip.slug,
        seats,
        payMode: payFull ? "FULL" : "ADVANCE",
        travellers: travellers.map((t) => ({
          fullName: t.fullName.trim(),
          phone: t.phone.trim(),
          email: t.email.trim(),
        })),
        emergencyContactName: emergencyName.trim(),
        emergencyContactPhone: emergencyPhone.trim(),
        notes: notes.trim(),
      });

      if (!order.ok) {
        setError(order.error);
        if (order.code === "SEATS_GONE" || order.code === "NOT_BOOKABLE") {
          setStep(1);
          router.refresh();
        }
        return;
      }

      await checkout.open(
        {
          keyId: order.keyId!,
          orderId: order.orderId,
          amountPaise: order.amountPaise,
          currency: order.currency,
          reference: order.reference,
          tripTitle: trip.title,
          customer: { name: customer.fullName, email: customer.email, phone: customer.phone },
        },
        {
          onSuccess: ({ orderId, paymentId, signature }) => {
            startTransition(async () => {
              const res = await fetch("/api/payments/verify", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  razorpay_order_id: orderId,
                  razorpay_payment_id: paymentId,
                  razorpay_signature: signature,
                }),
              });

              // Whether or not this succeeded, the money is taken and the
              // webhook will confirm the booking. Sending them to it is
              // right either way — never leave someone who has just paid
              // looking at an error with nowhere to go.
              if (!res.ok) {
                setError(
                  "Payment went through, but confirming it here took too long. " +
                    "Your booking will appear in a moment.",
                );
              } else {
                // The rare case where the money arrived after the seat had
                // gone. Say so here rather than letting them read it off a
                // status badge — they have just paid and deserve the plain
                // sentence, not a colour.
                const data = await res.json().catch(() => null);
                if (data?.seatLost) {
                  setError(
                    "Your payment went through, but the last seat was taken just before it " +
                      "reached us. We've emailed you — one of us will call within a working " +
                      "day with the next departure or a full refund.",
                  );
                }
              }
              router.push(`/account/bookings/${order.reference}?new=1`);
            });
          },
          onDismiss: () => {
            setError(
              `Payment cancelled. Your ${seats === 1 ? "seat is" : "seats are"} held for ` +
                `15 minutes — you can pay again from your bookings.`,
            );
            router.refresh();
          },
          onError: (message) => setError(message),
        },
      );
    });
  };

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
      <div className="order-2 lg:order-1">
        <Steps step={step} />

        {error && (
          <p
            role="alert"
            className="mb-5 flex items-start gap-2 rounded-2xl border border-coral/30 bg-coral/[0.07] px-4 py-3 text-sm text-navy"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-coral" />
            {error}
          </p>
        )}

        {step === 1 ? (
          <section className="rounded-3xl border border-navy/8 bg-cream p-6 md:p-8">
            <h2 className="font-display text-2xl tracking-tight text-navy">Who&apos;s coming?</h2>

            <div className="mt-5 flex flex-wrap items-center gap-4 border-b border-navy/8 pb-6">
              <div>
                <p className="text-sm font-medium text-navy">Seats</p>
                <p className="text-[0.8rem] text-navy/50">
                  {trip.seatsAvailable} left in this batch
                </p>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <SeatButton onClick={() => setSeatCount(seats - 1)} disabled={seats <= 1} label="One fewer seat">
                  <Minus className="h-4 w-4" />
                </SeatButton>
                <span className="w-10 text-center font-display text-xl tabular-nums text-navy">
                  {seats}
                </span>
                <SeatButton onClick={() => setSeatCount(seats + 1)} disabled={seats >= maxSeats} label="One more seat">
                  <Plus className="h-4 w-4" />
                </SeatButton>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-5">
              {travellers.map((t, i) => (
                <div key={i}>
                  <p className="mb-2.5 text-[0.78rem] font-semibold uppercase tracking-[0.1em] text-navy/45">
                    {i === 0 ? "Traveller 1 · you" : `Traveller ${i + 1}`}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                      label="Full name"
                      required
                      value={t.fullName}
                      onChange={(v) => patchTraveller(i, { fullName: v })}
                      error={fieldErrors[`${i}.fullName`]}
                      placeholder="As on their ID"
                      className="sm:col-span-2"
                    />
                    <Field
                      label="Phone"
                      required
                      value={t.phone}
                      onChange={(v) => patchTraveller(i, { phone: v })}
                      error={fieldErrors[`${i}.phone`]}
                      type="tel"
                      phone
                      placeholder="98765 43210"
                    />
                    <Field
                      label="Email"
                      required
                      value={t.email}
                      onChange={(v) => patchTraveller(i, { email: v })}
                      error={fieldErrors[`${i}.email`]}
                      type="email"
                      placeholder="name@example.com"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 border-t border-navy/8 pt-6">
              <p className="mb-2.5 text-[0.78rem] font-semibold uppercase tracking-[0.1em] text-navy/45">
                Emergency contact
              </p>
              <p className="mb-3 text-[0.83rem] text-navy/55">
                Someone not travelling with you. One for the whole group is fine.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Name" value={emergencyName} onChange={setEmergencyName} placeholder="Optional" />
                <Field
                  label="Phone"
                  value={emergencyPhone}
                  onChange={setEmergencyPhone}
                  type="tel"
                  phone
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="mt-8 border-t border-navy/8 pt-6">
              <label className="block">
                <span className="mb-2 block text-[0.78rem] font-semibold uppercase tracking-[0.1em] text-navy/45">
                  Anything we should know?
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="Food preferences, medical needs, who you'd like to room with…"
                  className="w-full rounded-xl border border-navy/12 bg-white px-3.5 py-2.5 text-[0.92rem] text-navy outline-none transition focus:border-teal"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={goToReview}
              className="btn btn-primary mt-8 inline-flex w-full justify-center sm:w-auto"
            >
              Review booking <ArrowRight className="h-4 w-4" />
            </button>
          </section>
        ) : (
          <section className="rounded-3xl border border-navy/8 bg-cream p-6 md:p-8">
            <h2 className="font-display text-2xl tracking-tight text-navy">Check it over</h2>
            <p className="mt-1 text-[0.9rem] text-navy/60">
              Nothing is charged now.{" "}
              {price.advanceDuePaise > 0
                ? "We'll email you and confirm the advance over WhatsApp."
                : "We'll email you, then the team will call to arrange payment."}
            </p>

            <dl className="mt-6 flex flex-col gap-px overflow-hidden rounded-2xl border border-navy/10">
              {travellers.map((t, i) => (
                <div key={i} className="bg-white px-4 py-3">
                  <dt className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-navy/40">
                    Traveller {i + 1}
                  </dt>
                  <dd className="mt-0.5 font-medium text-navy">{t.fullName}</dd>
                  <dd className="text-[0.83rem] text-navy/55">
                    {t.phone} · {t.email}
                  </dd>
                </div>
              ))}
              {(emergencyName || emergencyPhone) && (
                <div className="bg-white px-4 py-3">
                  <dt className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-navy/40">
                    Emergency contact
                  </dt>
                  <dd className="mt-0.5 text-navy">
                    {[emergencyName, emergencyPhone].filter(Boolean).join(" · ")}
                  </dd>
                </div>
              )}
              {notes && (
                <div className="bg-white px-4 py-3">
                  <dt className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-navy/40">
                    Notes
                  </dt>
                  <dd className="mt-0.5 whitespace-pre-line text-[0.9rem] text-navy/75">{notes}</dd>
                </div>
              )}
            </dl>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={payOnline ? payAndBook : submit}
                disabled={pending || checkout.busy}
                className="btn btn-yellow inline-flex justify-center disabled:opacity-70"
              >
                {pending || checkout.busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {payOnline ? "Opening payment…" : "Saving…"}
                  </>
                ) : payOnline ? (
                  <>
                    <Check className="h-4 w-4" /> Pay {formatINR(toRupees(payNowPaise))} &amp; book
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" /> Confirm booking request
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={pending}
                className="btn inline-flex justify-center border border-navy/20 text-navy transition hover:bg-navy/[0.04]"
              >
                <ArrowLeft className="h-4 w-4" /> Edit details
              </button>
            </div>
          </section>
        )}
      </div>

      <PriceSummary
        trip={trip}
        price={price}
        canChoose={canChoose}
        payFull={payFull}
        setPayMode={setPayMode}
        charge={charge}
        feeLabel={fee?.label ?? "Convenience fee"}
      />
    </div>
  );
}

function Steps({ step }: { step: 1 | 2 }) {
  return (
    <ol className="mb-5 flex items-center gap-3 text-[0.82rem]">
      {[
        { n: 1, label: "Traveller details" },
        { n: 2, label: "Review" },
      ].map((s) => (
        <li key={s.n} className="flex items-center gap-2">
          <span
            className={cn(
              "grid h-6 w-6 place-items-center rounded-full text-[0.72rem] font-bold",
              step >= s.n ? "bg-navy text-cream" : "bg-navy/10 text-navy/45",
            )}
          >
            {step > s.n ? <Check className="h-3 w-3" /> : s.n}
          </span>
          <span className={step >= s.n ? "font-medium text-navy" : "text-navy/45"}>{s.label}</span>
          {s.n === 1 && <span className="ml-1 h-px w-6 bg-navy/15" />}
        </li>
      ))}
    </ol>
  );
}

function PriceSummary({
  trip,
  price,
  canChoose,
  payFull,
  setPayMode,
  charge,
  feeLabel,
}: {
  trip: BookableTrip;
  price: ReturnType<typeof computePricing>;
  /** True only when there is a real choice: an advance, and a balance after it. */
  canChoose: boolean;
  payFull: boolean;
  setPayMode: (m: "ADVANCE" | "FULL") => void;
  charge: ReturnType<typeof computeConvenienceFee>;
  feeLabel: string;
}) {
  return (
    <aside className="order-1 lg:order-2 lg:sticky lg:top-28">
      <div className="overflow-hidden rounded-3xl border border-navy/8 bg-navy text-cream">
        <div className="border-b border-cream/10 px-6 py-5">
          <p className="font-display text-lg leading-tight">{trip.title}</p>
          <p className="mt-1 text-[0.83rem] text-cream/60">
            {formatDateRange(trip.startDate.toISOString(), trip.endDate.toISOString())}
          </p>
          {trip.startingFrom && (
            <p className="text-[0.83rem] text-cream/60">Starting from {trip.startingFrom}</p>
          )}
        </div>

        <dl className="px-6 py-5 text-[0.88rem]">
          <Row
            label={`${formatINR(toRupees(price.unitPricePaise))} × ${price.seats} ${price.seats === 1 ? "traveller" : "travellers"}`}
            value={formatINR(toRupees(price.subtotalPaise))}
          />
          <Row label={`GST ${price.gstPercent}%`} value={formatINR(toRupees(price.gstPaise))} />
          {price.tcsPercent > 0 && (
            <Row
              label={`TCS ${price.tcsPercent}%`}
              value={formatINR(toRupees(price.tcsPaise))}
              hint="Government levy on overseas packages. Claimable against your income tax."
            />
          )}
          <div className="mt-3 flex items-baseline justify-between border-t border-cream/15 pt-3">
            <dt className="font-medium">Total</dt>
            <dd className="font-display text-2xl tabular-nums">
              {formatINR(toRupees(price.totalPaise))}
            </dd>
          </div>
        </dl>

        {/* The fee, disclosed before payment.
            RBI and card-network rules require the customer be told the amount
            before the transaction — not merely on the receipt. It sits under
            the pay-mode choice so it re-reads correctly when they switch
            between advance and full. */}
        {charge.feePaise > 0 && (
          <div className="border-t border-cream/10 px-6 py-4">
            <div className="flex items-baseline justify-between text-[0.85rem]">
              <span className="text-cream/70">
                {feeLabel}{" "}
                <span className="text-cream/40">({formatFeeRate(charge.rateBp)})</span>
              </span>
              <span className="tabular-nums text-cream/85">
                {formatINR(toRupees(charge.feePaise))}
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline justify-between border-t border-cream/15 pt-2.5">
              <span className="font-medium">Pay now</span>
              <b className="font-display text-xl tabular-nums text-yellow">
                {formatINR(toRupees(charge.grossPaise))}
              </b>
            </div>
            <p className="mt-2 text-[0.72rem] leading-snug text-cream/40">
              Charged by the payment gateway on online payments. Pay us directly
              and there&apos;s no fee.
            </p>
          </div>
        )}

        {canChoose && (
          <fieldset className="border-t border-cream/10 bg-cream/[0.04] px-6 py-4">
            <legend className="sr-only">How much to pay now</legend>
            <p className="mb-2.5 text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-cream/45">
              Pay now
            </p>
            <div className="flex flex-col gap-2">
              <PayChoice
                checked={!payFull}
                onSelect={() => setPayMode("ADVANCE")}
                label="Advance"
                amount={formatINR(toRupees(price.advanceDuePaise))}
                hint={`${formatINR(toRupees(price.balancePaise))} due before departure`}
              />
              <PayChoice
                checked={payFull}
                onSelect={() => setPayMode("FULL")}
                label="Full amount"
                amount={formatINR(toRupees(price.totalPaise))}
                hint="Nothing left to pay. Done in one go."
              />
            </div>
          </fieldset>
        )}
      </div>

      <p className="mt-3 px-1 text-[0.8rem] leading-relaxed text-navy/50">
        No payment is taken online right now. Submitting holds your seats
        {price.advanceDuePaise > 0
          ? " and the team will reach out to collect the advance."
          : " and the team will contact you to arrange payment."}
      </p>
    </aside>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="mb-2">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-cream/75">{label}</dt>
        <dd className="tabular-nums">{value}</dd>
      </div>
      {hint && <p className="mt-0.5 text-[0.75rem] leading-snug text-cream/40">{hint}</p>}
    </div>
  );
}

function SeatButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid h-10 w-10 place-items-center rounded-full border border-navy/15 bg-white text-navy transition hover:border-navy disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-navy/15"
    >
      {children}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  error,
  className,
  phone,
}: {
  /** Renders the country code beside the box and holds the value to 10 digits. */
  phone?: boolean;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[0.8rem] font-medium text-navy/70">
        {label}
        {required && <span className="ml-0.5 text-coral">*</span>}
      </span>
      <span
        className={cn(
          "flex w-full items-center gap-1.5 rounded-xl border bg-white px-3.5 py-2.5 text-[0.92rem] text-navy transition focus-within:border-teal",
          error ? "border-coral" : "border-navy/12",
        )}
      >
        {phone && (
          <span aria-hidden className="flex-none select-none text-navy/45">
            {PHONE_COUNTRY_CODE}
          </span>
        )}
        <input
          type={type}
          value={value}
          inputMode={phone ? "numeric" : undefined}
          maxLength={phone ? 10 : undefined}
          onChange={(e) => onChange(phone ? sanitisePhoneInput(e.target.value) : e.target.value)}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-label={phone ? `${label}, ${PHONE_COUNTRY_CODE}` : undefined}
          className="w-full min-w-0 border-0 bg-transparent p-0 outline-none"
        />
      </span>
      {error && <span className="mt-1 block text-[0.78rem] text-coral">{error}</span>}
    </label>
  );
}

/**
 * One of the two pay-now options.
 *
 * A radio rather than a toggle: both amounts stay on screen, so the choice is
 * made by comparing two numbers rather than by flipping something and
 * watching a figure change. The whole row is the label, so the tap target is
 * the card and not a 16px circle.
 */
function PayChoice({
  checked,
  onSelect,
  label,
  amount,
  hint,
}: {
  checked: boolean;
  onSelect: () => void;
  label: string;
  amount: string;
  hint: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition",
        checked
          ? "border-yellow/60 bg-yellow/[0.09]"
          : "border-cream/15 hover:border-cream/30 hover:bg-cream/[0.04]",
      )}
    >
      <input
        type="radio"
        name="payMode"
        checked={checked}
        onChange={onSelect}
        className="mt-1 h-4 w-4 flex-none accent-yellow"
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-[0.9rem] font-medium text-cream">{label}</span>
          <b
            className={cn(
              "font-display text-lg tabular-nums",
              checked ? "text-yellow" : "text-cream/70",
            )}
          >
            {amount}
          </b>
        </span>
        <span className="mt-0.5 block text-[0.78rem] leading-snug text-cream/50">{hint}</span>
      </span>
    </label>
  );
}
