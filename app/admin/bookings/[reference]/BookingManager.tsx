"use client";

import { PhoneInput } from "@/components/shared/PhoneInput";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertCircle, Check, IndianRupee, Loader2, Pencil, Trash2, X } from "lucide-react";

// toRupees, not the identical `rupees` from queries/admin: that module is
// server-only and importing it here drags Prisma and pg into the browser
// bundle, which fails the build.
import { toRupees } from "@/lib/booking/pricing";
import { statusOpen } from "@/lib/booking/lifecycle";
import { sanitiseAmountInput } from "@/lib/money";
import { formatINR } from "@/lib/utils";
import { BOOKING_TONE, Chip, Panel } from "../../ui";
import {
  cancelSeat,
  recordPayment,
  refundBooking,
  sendBalanceReminderNow,
  updateBookingDetails,
  updateBookingStatus,
  carryBookingForward,
  recordOfflineRefund,
  type ActionResult,
} from "../actions";

type Traveller = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  cancelledAt: Date | string | null;
};

const METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "UPI_MANUAL", label: "UPI" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "RAZORPAY", label: "Razorpay" },
  { value: "OTHER", label: "Other" },
];

const SOURCES = [
  { value: "WEB", label: "Website" },
  { value: "ADMIN_OFFLINE", label: "Offline" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "FESTIVAL", label: "Festival" },
];

/**
 * What an admin may set by hand.
 *
 * EXPIRED is left out: it is something that HAPPENS to a booking, not
 * something anyone decides. The release-holds cron sets it when a checkout
 * is abandoned, and createOrder sets it on the old booking when a customer
 * restarts — both automatic, both meaning "this never became a booking".
 * Picking it by hand would claim a customer walked away when they didn't.
 *
 * No need to keep it for a booking that already IS expired: statusOpen()
 * refuses every closed status, so that panel renders read-only and this
 * select never appears on one. The filter dropdowns are built from
 * BOOKING_TONE directly and still offer it — you filter by what is stored.
 */
const SETTABLE_BY_HAND = new Set(["EXPIRED"]);
const STATUSES = Object.entries(BOOKING_TONE)
  .filter(([value]) => !SETTABLE_BY_HAND.has(value))
  .map(([value, v]) => ({ value, label: v.label }));

/** Shared plumbing: run an action, surface its error, refresh on success. */
function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<ActionResult>, onDone?: () => void) => {
    setError(null);
    start(async () => {
      const result = await fn();
      if (result.ok) {
        router.refresh();
        onDone?.();
      } else {
        setError(result.error);
      }
    });
  };

  return { run, pending, error, setError };
}

/**
 * The booking belongs to whoever is paying for it, for the next few minutes.
 *
 * Shown instead of the form rather than beside it: a disabled amount box on
 * a screen whose whole job is taking money invites typing into it and
 * wondering why nothing happens.
 */
function InCheckout({ minsLeft, what }: { minsLeft: number; what: string }) {
  return (
    <p
      role="alert"
      className="mt-3 rounded-lg border border-[#cfe3ef] bg-[#eaf4f9] px-3.5 py-3 text-[0.83rem] leading-relaxed text-[#1d5f7a]"
    >
      <strong>Someone is paying for this booking right now.</strong> Their seats are held for
      another {minsLeft} minute{minsLeft === 1 ? "" : "s"} — {what} until the payment lands,
      or the hold lapses on its own.
    </p>
  );
}

export function PaymentPanel({
  bookingId,
  balancePaise,
  customerName,
  creditPaise = 0,
  inCheckout = false,
  checkoutMinsLeft = 0,
}: {
  bookingId: string;
  /** A customer is mid-Razorpay on this booking. See checkoutInFlight(). */
  inCheckout?: boolean;
  checkoutMinsLeft?: number;
  balancePaise: number;
  customerName: string;
  /** What this customer is holding in travel credit, across all bookings. */
  creditPaise?: number;
}) {
  const { run, pending, error } = useAction();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const enteredPaise = Math.round((Number(amount) || 0) * 100);
  const overBalance = enteredPaise > balancePaise;

  /**
   * Travel credit is a payment METHOD here, exactly as it is on the new
   * booking form — "how did they pay? with their credit" is the same
   * sentence as "with cash" and belongs in the same control, not in a second
   * amount box the admin has to reconcile by hand.
   */
  const payingByCredit = method === "CREDIT";
  const overCredit = payingByCredit && enteredPaise > creditPaise;
  /**
   * Never offer more credit than this booking is short.
   *
   * Applying a ₹15,000 balance to a ₹4,200 trip doesn't buy anything — it
   * creates an overpayment we then owe back in cash, turning credit they
   * could have spent on a future trip into a refund we have to make now.
   * Whatever is left simply stays in the ledger.
   */
  const applicablePaise = Math.min(creditPaise, balancePaise);
  const creditCovers = creditPaise > balancePaise;

  /**
   * Offered only when there is credit to spend — an option that always
   * errors is worse than one that isn't there. Slotted in above "Other", the
   * same position it holds on the new booking form, so it reads as one more
   * way money can arrive rather than an afterthought.
   */
  const methodOptions =
    creditPaise > 0
      ? METHODS.flatMap((m) =>
          m.value === "OTHER"
            ? [
                {
                  value: "CREDIT",
                  label: `Travel credit — ${formatINR(toRupees(creditPaise))} available`,
                },
                m,
              ]
            : [m],
        )
      : METHODS;

  const submit = () =>
    run(
      () => recordPayment({ bookingId, method: method as "CASH", amountPaise: amount, externalReference: reference, notes }),
      () => {
        setAmount("");
        setReference("");
        setNotes("");
        setMethod("CASH");
      },
    );

  /**
   * A fully-paid booking gets no form.
   *
   * Disabling the button would leave the fields sitting there inviting an
   * amount, and a validation message is a worse answer than never asking the
   * question. There is nothing owed, so there is nothing to record — and
   * money genuinely taken beyond the total is a repricing or a mistake, both
   * of which want a person thinking rather than a quick entry here.
   */
  if (inCheckout) {
    return (
      <Panel title="Record a payment">
        <div className="px-5 pb-5">
          <InCheckout minsLeft={checkoutMinsLeft} what="nothing can be recorded" />
        </div>
      </Panel>
    );
  }

  if (balancePaise <= 0) {
    return (
      <Panel title="Record a payment">
        <p className="px-5 py-6 text-center text-[0.86rem] text-[#5a6785]">
          This booking is paid in full — there&apos;s nothing left to record.
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="Record a payment">
      <div className="px-5 py-4">
        {error && <ErrorNote>{error}</ErrorNote>}

        {/* Shown whether or not credit is the chosen method. Hiding it behind
            a dropdown option means only someone who already knew to look
            would find it — which is nobody, since the whole point is that a
            cancellation weeks ago left money behind. Credit nobody notices
            never gets spent. */}
        {creditPaise > 0 && (
          <div
            className={`mb-3.5 rounded-xl border px-4 py-3 ${
              overCredit ? "border-[#f0c9c4] bg-[#fdf2f0]" : "border-[#d7e8e2] bg-[#f2f9f6]"
            }`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[0.87rem] text-[#16203a]">
                <strong>{customerName}</strong> has{" "}
                <strong>{formatINR(toRupees(creditPaise))}</strong> of travel credit.
              </p>
              <button
                type="button"
                onClick={() => {
                  setMethod("CREDIT");
                  setAmount(String(toRupees(applicablePaise)));
                }}
                className="text-[0.8rem] font-medium text-[#0f7a55] underline underline-offset-2"
              >
                {creditCovers ? "Put ₹" + toRupees(applicablePaise).toLocaleString("en-IN") + " towards this" : "Use it"}
              </button>
            </div>

            {overCredit ? (
              <p className="mt-1.5 text-[0.8rem] font-medium text-[#b3261e]">
                That&apos;s more than they have. The most you can apply is{" "}
                {formatINR(toRupees(creditPaise))}.
              </p>
            ) : creditCovers ? (
              <p className="mt-1.5 text-[0.78rem] text-[#5a6785]">
                That is more than the {formatINR(toRupees(balancePaise))} outstanding — only the
                balance can go on this booking, and the rest stays as credit.
              </p>
            ) : payingByCredit ? (
              <p className="mt-1.5 text-[0.78rem] text-[#5a6785]">
                Recorded as a payment on this booking. Anything left stays as credit.
              </p>
            ) : (
              <p className="mt-1.5 text-[0.78rem] text-[#5a6785]">
                Choose <strong>Travel credit</strong> as the method to put it towards this
                booking.
              </p>
            )}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Amount received">
            <div className="flex items-center gap-1.5 rounded-lg border border-[#e3e7ee] bg-white px-3 py-[7px] focus-within:border-teal">
              <IndianRupee className="h-3.5 w-3.5 flex-none text-[#8b96ad]" />
              <input
                value={amount}
                onChange={(e) => setAmount(sanitiseAmountInput(e.target.value))}
                inputMode="decimal"
                placeholder="19999"
                className="w-full border-0 bg-transparent text-[0.88rem] outline-none"
              />
            </div>
            {overCredit ? (
              <p className="mt-1 text-[0.75rem] font-medium text-[#b3261e]">
                Only {formatINR(toRupees(creditPaise))} of credit available.
              </p>
            ) : overBalance ? (
              <p className="mt-1 text-[0.75rem] font-medium text-[#b3261e]">
                More than the {formatINR(toRupees(balancePaise))} outstanding.
              </p>
            ) : (
              <button
                type="button"
                onClick={() => setAmount(String(toRupees(balancePaise)))}
                className="mt-1 text-[0.75rem] text-teal underline underline-offset-2"
              >
                Fill the full balance ({formatINR(toRupees(balancePaise))})
              </button>
            )}
          </Field>

          <Field label="How they paid">
            <Select value={method} onChange={setMethod} options={methodOptions} />
          </Field>

          <Field label="Reference / UTR">
            <Input
              value={reference}
              onChange={setReference}
              placeholder={payingByCredit ? "Not needed for credit" : "Optional"}
              disabled={payingByCredit}
            />
          </Field>
          <Field label="Note">
            <Input value={notes} onChange={setNotes} placeholder="Optional" />
          </Field>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={pending || !amount.trim() || overBalance || overCredit}
          className={PRIMARY_BTN + " mt-4"}
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Record payment
        </button>
        <p className="mt-2 text-[0.78rem] text-[#8b96ad]">
          {payingByCredit
            ? "Comes out of their travel credit and counts as a payment on this booking. A request becomes confirmed on its first payment."
            : "Adds to the paid total and recalculates the balance. A request becomes confirmed on its first payment."}
        </p>
      </div>
    </Panel>
  );
}

/**
 * What the customer is told when a status changes.
 *
 * Mirrors notifyStatusChange() in lib/booking/notify.ts. Kept in the same
 * words so the person clicking the button knows exactly what lands in
 * someone's inbox — a status change is no longer a private bookkeeping
 * edit, and an admin who doesn't realise that will send a cancellation
 * notice by picking the wrong row in a dropdown.
 */
/**
 * The status panel's action button.
 *
 * Teal rather than the navy used for the filter bars: navy at 50% opacity
 * was almost indistinguishable from navy at full, so the button read as
 * disabled whether it was or not. Disabled is now a flat grey with no hover
 * and no shadow — a different thing, not a fainter version of the same one.
 *
 * A step darker than --color-teal, brightening on hover the way
 * .btn-primary does. The brand teal under cream text measures 3.9:1, below
 * the 4.5:1 body-sized text needs; these two shades read as the same colour
 * and measure 5.7:1 at rest and 5.0:1 hovered.
 */
const PRIMARY_BTN =
  "inline-flex items-center gap-1.5 rounded-lg bg-[#146e6e] px-4 py-2 text-[0.85rem] " +
  "font-semibold text-cream shadow-sm transition-colors hover:bg-[#177878] " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-teal disabled:cursor-not-allowed disabled:bg-[#e6e9ef] " +
  "disabled:text-[#9aa4b8] disabled:shadow-none disabled:hover:bg-[#e6e9ef]";

const STATUS_EMAIL: Record<string, string> = {
  CONFIRMED: "a booking confirmation",
  CANCELLED: "a cancellation notice",
};

export function StatusPanel({
  inCheckout = false,
  checkoutMinsLeft = 0,
  bookingId,
  reference,
  status,
  seatsCounted,
  customerEmail,
  customerName,
  amountPaidPaise,
  refundedPaise,
  pendingRefundPaise = 0,
}: {
  /** A customer is mid-Razorpay on this booking. See checkoutInFlight(). */
  inCheckout?: boolean;
  checkoutMinsLeft?: number;
  bookingId: string;
  reference: string;
  status: string;
  seatsCounted: boolean;
  /** Shown on the confirm step so nobody emails the wrong person. */
  customerEmail: string | null;
  customerName: string;
  amountPaidPaise: number;
  refundedPaise: number;
  /** Asked of Razorpay, not yet confirmed. Blocks carrying forward. */
  pendingRefundPaise?: number;
}) {
  const { run, pending, error } = useAction();
  const [next, setNext] = useState(status);
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  /**
   * What we are actually holding: paid minus anything already refunded.
   *
   * The default credit, and the figure the "more than they paid" warning is
   * measured against. A booking that took ₹6,300 and sent ₹2,000 back holds
   * ₹4,300 — offering to carry ₹6,300 forward would invent money we no
   * longer have.
   */
  const heldPaise = Math.max(amountPaidPaise - refundedPaise, 0);
  const [credit, setCredit] = useState(String(heldPaise / 100));

  const cancelling = next === "CANCELLED";
  const changed = next !== status;
  /**
   * Only while it is a CHANGE.
   *
   * On a booking already carried forward, `next` starts equal to the current
   * status — so without `changed` the panel re-opens the credit fields, shows
   * a held figure that has already been given away, and invites doing it a
   * second time.
   */
  const carrying = next === "CARRIED_FORWARD" && changed;
  /**
   * A refund already on its way out rules carrying forward out entirely.
   *
   * The server refuses it too. This is here so the button never looks
   * available for something that cannot happen — and so the reason is on
   * screen next to the choice, rather than arriving as an error after it.
   */
  const refundInFlight = carrying && pendingRefundPaise > 0;
  const willEmail = carrying ? "their travel credit" : STATUS_EMAIL[next];

  const creditPaise = Math.round((Number(credit) || 0) * 100);
  const aboveHeld = creditPaise > heldPaise;
  const creditValid = creditPaise > 0 && creditPaise >= 0;
  /**
   * The charge is the other half of the same number, and either can be typed.
   *
   * Only the credit is state — the charge is derived from it, and typing in
   * the charge box writes back through the same subtraction. Holding both as
   * state would mean two values that can disagree, and the moment they do,
   * neither the screen nor the ledger can say which one the admin meant.
   *
   * Clamped at zero for display: once the credit goes above what we hold, the
   * charge is not a negative charge, it is goodwill — which gets its own line
   * rather than a minus sign in a box labelled "charge".
   */
  const chargePaise = Math.max(heldPaise - creditPaise, 0);
  const chargeInput = String(chargePaise / 100);
  const canSubmit = changed && (!carrying || creditValid) && !refundInFlight && !done;

  /**
   * A closed booking shows its status and nothing else.
   *
   * Not a disabled dropdown: an admin reading a greyed-out list of statuses
   * has to work out for themselves which one is refusing and why. The server
   * refuses this too — see lib/booking/lifecycle.ts — and this panel exists
   * so nobody reaches that error by clicking a control that looked live.
   */
  if (inCheckout) {
    return (
      <Panel title="Status">
        <div className="px-5 pb-5">
          <InCheckout minsLeft={checkoutMinsLeft} what="the status can't be changed" />
        </div>
      </Panel>
    );
  }

  if (!statusOpen(status)) {
    const tone = BOOKING_TONE[status];
    return (
      <Panel title="Status">
        <div className="px-5 py-4">
          <Chip tone={tone?.tone ?? "mute"}>{tone?.label ?? status}</Chip>
          <p className="mt-2.5 text-[0.83rem] leading-relaxed text-[#5a6785]">
            This booking is closed, so its status can&apos;t be changed. Reopening it would
            erase how it ended — and, for one carried forward, could hand out the same money
            as credit twice.
          </p>
          <p className="mt-1.5 text-[0.8rem] leading-relaxed text-[#8b96ad]">
            Refunds and payments can still be recorded above. If this one is wrong, take a new
            booking rather than reviving this record.
          </p>
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Status">
      <div className="px-5 py-4">
        {error && error !== "ABOVE_PAID" && <ErrorNote>{error}</ErrorNote>}
        {done && <p className="mb-2 text-[0.83rem] font-medium text-[#0f7a55]">{done}</p>}

        <Field label="Booking status">
          <Select
            value={next}
            onChange={(v) => {
              setNext(v);
              // Changing the target invalidates anything already confirmed.
              setConfirming(false);
            }}
            options={STATUSES}
          />
        </Field>

        {cancelling && (
          <div className="mt-3">
            <Field label="Reason (optional)">
              <Input value={reason} onChange={setReason} placeholder="Why is it being cancelled?" />
            </Field>
          </div>
        )}

        {refundInFlight && (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-[#f0dcae] bg-[#fdf1dc] px-3 py-2.5 text-[0.82rem] leading-relaxed text-[#7a4a00]"
          >
            <strong>{formatINR(toRupees(pendingRefundPaise))} is on its way back</strong>{" "}
            through Razorpay. Until it lands, this can&apos;t be carried forward — the same
            money would go to their bank and become credit here. Wait for the refund to
            complete, then carry forward whatever is left.
          </p>
        )}

        {/* Carrying forward needs an amount, so the extra fields appear here
            rather than behind a second button. The status IS the decision;
            these are its terms. */}
        {carrying && !refundInFlight && (
          <div className="mt-3 rounded-lg border border-[#e3e7ee] bg-[#fbfcfd] p-3.5">
            <div className="flex items-baseline justify-between text-[0.83rem]">
              <span className="text-[#5a6785]">{customerName} has held</span>
              <span className="font-semibold tabular-nums text-[#16203a]">
                {formatINR(toRupees(heldPaise))}
              </span>
            </div>
            {refundedPaise > 0 && (
              <p className="mt-0.5 text-right text-[0.75rem] text-[#8b96ad]">
                {formatINR(toRupees(amountPaidPaise))} paid ·{" "}
                {formatINR(toRupees(refundedPaise))} already refunded
              </p>
            )}

            {/* Either box can be typed; they always add up to what is held.
                Whichever one the admin thinks in — "give them ₹4,000" or
                "keep ₹500" — is the one they can fill. */}
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Travel credit (₹)">
                <Input
                  value={credit}
                  onChange={(v) => {
                    setCredit(sanitiseAmountInput(v));
                    setConfirming(false);
                  }}
                  placeholder="0"
                />
              </Field>
              <Field label="Cancellation charge (₹)">
                <Input
                  value={chargeInput}
                  onChange={(v) => {
                    const typed = Math.round((Number(sanitiseAmountInput(v)) || 0) * 100);
                    setCredit(String(Math.max(heldPaise - typed, 0) / 100));
                    setConfirming(false);
                  }}
                  placeholder="0"
                />
              </Field>
            </div>

            <p className="mt-1.5 text-[0.75rem] text-[#8b96ad]">
              The two add up to {formatINR(toRupees(heldPaise))}. Type either one.
            </p>

            {aboveHeld && (
              <p className="mt-2 flex justify-between rounded-lg bg-[#fdf1dc] px-3 py-2 text-[0.8rem] text-[#7a4a00]">
                <span>Goodwill added — above what we hold</span>
                <span className="font-semibold tabular-nums">
                  {formatINR(toRupees(creditPaise - heldPaise))}
                </span>
              </p>
            )}

            <div className="mt-3">
              <Field label="Note (shown to the customer)">
                <Input value={reason} onChange={setReason} placeholder="Optional" />
              </Field>
            </div>
          </div>
        )}

        {changed && !refundInFlight && (
          <p className="mt-3 rounded-lg bg-[#fdf1dc] px-3 py-2 text-[0.8rem] leading-relaxed text-[#7a4a00]">
            {seatsCounted && !["REQUESTED", "CONFIRMED"].includes(next)
              ? "Seats will be released back to the trip."
              : !seatsCounted && ["REQUESTED", "CONFIRMED"].includes(next)
                ? "Seats will be taken from the trip — this fails if it's now full."
                : "Seat count is unchanged."}
          </p>
        )}

        {changed && !refundInFlight && (
          <p
            className={`mt-2 rounded-lg px-3 py-2 text-[0.8rem] leading-relaxed ${
              willEmail ? "bg-[#eaf4ef] text-[#0f5c3f]" : "bg-[#f2f4f7] text-[#5a6785]"
            }`}
          >
            {willEmail ? (
              <>
                <strong>{customerEmail ?? "The customer"}</strong> will be emailed{" "}
                {carrying ? willEmail : `a ${willEmail.replace(/^a /, "")}`}.
              </>
            ) : (
              "No email will be sent — this status is internal bookkeeping."
            )}
          </p>
        )}

        {!confirming ? (
          <>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={pending || !canSubmit}
              className={PRIMARY_BTN + " mt-4"}
            >
              Update status
            </button>
            {/* It sits disabled most of the time — on load `next` is the
                current status, so there is nothing to save. Say that, rather
                than leaving a faded button and no reason for it. */}
            {!changed && !done && (
              <p className="mt-2 text-[0.78rem] text-[#8b96ad]">
                Choose a different status to update this booking.
              </p>
            )}
          </>
        ) : (
          <div className="mt-4 rounded-lg border border-[#e3e7ee] bg-[#fbfcfd] p-3.5">
            <p className="text-[0.85rem] leading-relaxed text-[#16203a]">
              {carrying ? (
                <>
                  Cancel <strong>{reference}</strong>, release its seats, and give{" "}
                  {customerName} <strong>{formatINR(toRupees(creditPaise))}</strong> of travel
                  credit?
                </>
              ) : (
                <>
                  Change status to <strong>{BOOKING_TONE[next]?.label ?? next}</strong>
                  {willEmail ? <> and email {customerEmail ?? "the customer"} {willEmail}?</> : "?"}
                </>
              )}
            </p>

            {carrying && aboveHeld && (
              <p className="mt-1.5 rounded-lg bg-[#fdf1dc] px-3 py-2 text-[0.8rem] leading-relaxed text-[#7a4a00]">
                That is {formatINR(toRupees(creditPaise - heldPaise))} more than{" "}
                {customerName} has with us.
              </p>
            )}
            {carrying && <p className="mt-1.5 text-[0.78rem] text-[#8b96ad]">No money is refunded.</p>}
            {!carrying && willEmail && (
              <p className="mt-1 text-[0.78rem] text-[#8b96ad]">This can&apos;t be unsent.</p>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  run(async () => {
                    // Carrying forward has its own action: it needs an
                    // amount, writes to the credit ledger and sends a
                    // different email.
                    const res = carrying
                      ? await carryBookingForward({
                          reference,
                          creditRupees: Number(credit),
                          note: reason,
                          confirmedAbovePaid: true,
                        })
                      : await updateBookingStatus({
                          bookingId,
                          status: next as "CONFIRMED",
                          reason,
                        });
                    if (res.ok) {
                      setConfirming(false);
                      if (carrying) {
                        const info = "info" in res ? res.info : undefined;
                        setDone(typeof info === "string" ? info : "Carried forward.");
                      }
                    }
                    return res;
                  })
                }
                disabled={pending}
                className={PRIMARY_BTN}
              >
                {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {carrying ? "Carry forward" : willEmail ? "Update & send email" : "Update status"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={pending}
                className="rounded-lg border border-[#e3e7ee] px-3.5 py-2 text-[0.85rem] font-medium text-[#5a6785] hover:bg-[#f6f7f9] disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

export function DetailsPanel({
  bookingId,
  source,
  internalNotes,
  travellers,
  canRemoveSeat,
}: {
  bookingId: string;
  source: string;
  internalNotes: string | null;
  travellers: Traveller[];
  canRemoveSeat: boolean;
}) {
  const { run, pending, error } = useAction();
  const [editing, setEditing] = useState(false);
  const [src, setSrc] = useState(source);
  const [notes, setNotes] = useState(internalNotes ?? "");
  const [rows, setRows] = useState(travellers);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  // Re-sync when the server sends fresh travellers after an action.
  //
  // `rows` seeds from props once, so after cancelling a seat the panel kept
  // rendering the pre-cancel list until the page was reloaded by hand. Keying
  // on the identity+state of the list means a change from the server lands
  // immediately, while local edits in between are left alone.
  const signature = travellers.map((t) => `${t.id}:${t.cancelledAt ?? ""}`).join("|");
  const [syncedTo, setSyncedTo] = useState(signature);
  if (signature !== syncedTo && !editing) {
    setSyncedTo(signature);
    setRows(travellers);
    setConfirmId(null);
  }

  // Seats follow the people still going; cancelled travellers stay listed.
  const activeCount = rows.filter((t) => !t.cancelledAt).length;

  // With one traveller left there's no "seat" to cancel — that's cancelling
  // the booking, which belongs to the Status panel where it releases seats
  // and records a reason. Offering it here would just fail.
  const canCancelSeats = canRemoveSeat && activeCount > 1;

  const patch = (id: string, changes: Partial<Traveller>) =>
    setRows((prev) => prev.map((t) => (t.id === id ? { ...t, ...changes } : t)));

  const save = () =>
    run(
      () =>
        updateBookingDetails({
          bookingId,
          source: src as "WEB",
          internalNotes: notes,
          travellers: rows.map((t) => ({
            id: t.id,
            fullName: t.fullName,
            phone: t.phone ?? "",
            email: t.email ?? "",
          })),
        }),
      () => setEditing(false),
    );

  return (
    <Panel
      title="Travellers & details"
      action={
        editing ? (
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setRows(travellers);
              setSrc(source);
              setNotes(internalNotes ?? "");
            }}
            className="inline-flex items-center gap-1 text-[0.82rem] text-[#5a6785] hover:text-navy"
          >
            <X className="h-3.5 w-3.5" /> Cancel
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 text-[0.82rem] text-[#5a6785] hover:text-navy"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
        )
      }
    >
      <div className="px-5 py-4">
        {error && <ErrorNote>{error}</ErrorNote>}

        <ul className="flex flex-col gap-3">
          {rows.map((t, i) => {
            const cancelled = !!t.cancelledAt;
            return (
            <li
              key={t.id}
              className={`rounded-xl border border-[#eef1f6] bg-[#fcfdfe] p-3.5 ${
                cancelled ? "opacity-55 grayscale" : ""
              }`}
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-[#8b96ad]">
                  Traveller {i + 1}
                </span>
                {cancelled && (
                  <span className="rounded-full bg-[#fdeaea] px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[#c33a3a]">
                    Cancelled
                  </span>
                )}
                {canCancelSeats && !cancelled && (
                  <button
                    type="button"
                    onClick={() => setConfirmId(t.id)}
                    // One confirmation at a time. Leaving the others live
                    // invites cancelling two seats from two open dialogs when
                    // only one could actually go.
                    disabled={pending || (confirmId !== null && confirmId !== t.id)}
                    className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.78rem] text-[#c33a3a] transition hover:bg-[#fdeaea] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
                  >
                    <Trash2 className="h-3 w-3" /> Cancel this seat
                  </button>
                )}
              </div>

              {confirmId === t.id && (
                <div className="mb-3 rounded-lg border border-[#f0c9c9] bg-[#fdf5f5] px-3 py-2.5">
                  <p className="text-[0.82rem] leading-relaxed text-navy">
                    Remove <b>{t.fullName}</b>? Their seat goes back to the trip and the booking is
                    re-priced for {activeCount - 1} traveller{activeCount - 1 === 1 ? "" : "s"}.
                  </p>
                  <div className="mt-2.5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => run(() => cancelSeat({ bookingId, travellerId: t.id }), () => setConfirmId(null))}
                      disabled={pending}
                      className="inline-flex items-center gap-1.5 rounded-md bg-[#c33a3a] px-2.5 py-1.5 text-[0.8rem] font-medium text-white disabled:opacity-50"
                    >
                      {pending && <Loader2 className="h-3 w-3 animate-spin" />}
                      Yes, remove
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      className="rounded-md px-2.5 py-1.5 text-[0.8rem] text-[#5a6785]"
                    >
                      Keep
                    </button>
                  </div>
                </div>
              )}

              {editing && !cancelled ? (
                <div className="grid gap-2.5 sm:grid-cols-3">
                  <Input value={t.fullName} onChange={(v) => patch(t.id, { fullName: v })} placeholder="Full name" />
                  <PhoneInput
                    value={t.phone ?? ""}
                    onChange={(v) => patch(t.id, { phone: v })}
                    className={controlClass}
                  />
                  <Input value={t.email ?? ""} onChange={(v) => patch(t.id, { email: v })} placeholder="Email" />
                </div>
              ) : (
                <>
                  <p className="text-[0.9rem] font-semibold text-navy">{t.fullName}</p>
                  <p className="text-[0.8rem] text-[#8b96ad]">
                    {[t.phone, t.email].filter(Boolean).join(" · ") || "no contact"}
                  </p>
                </>
              )}
            </li>
            );
          })}
        </ul>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Source">
            {editing ? (
              <Select value={src} onChange={setSrc} options={SOURCES} />
            ) : (
              <Chip tone="mute">{SOURCES.find((s) => s.value === src)?.label ?? src}</Chip>
            )}
          </Field>
        </div>

        <div className="mt-3">
          <Field label="Internal notes">
            {editing ? (
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-[#e3e7ee] bg-white px-3 py-2 text-[0.86rem] outline-none focus:border-teal"
              />
            ) : (
              <p className="whitespace-pre-line text-[0.86rem] text-[#5a6785]">
                {notes || <span className="text-[#c3cad8]">None</span>}
              </p>
            )}
          </Field>
        </div>

        {editing && (
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-navy px-3.5 py-2 text-[0.85rem] font-medium text-cream hover:bg-[#1b2f56] disabled:opacity-50"
          >
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save changes
          </button>
        )}
      </div>
    </Panel>
  );
}

/**
 * Sends money back through Razorpay.
 *
 * Deliberately more friction than recording a payment: a refund leaves the
 * account and cannot be undone from here, so it asks for a reason and states
 * the ceiling rather than silently clamping to it.
 *
 * The figure it shows is what has actually LEFT the account — Razorpay
 * confirms refunds asynchronously, so a refund requested a minute ago is
 * still counted as pending, not refunded.
 */
export function RefundPanel({
  reference,
  refundablePaise,
  pendingPaise,
  gatewayRefundedPaise,
  otherRefundedPaise,
  heldPaise,
  owedPaise,
  gatewayPaidPaise,
  creditPaidPaise,
  hasOnlinePayment,
}: {
  reference: string;
  /** The CEILING — the smaller of what Razorpay holds and what we hold. */
  refundablePaise: number;
  /** What actually reached Razorpay. */
  gatewayPaidPaise: number;
  /**
   * Paid with travel credit. Razorpay never saw it, so it cannot be refunded
   * — it goes back by carrying the booking forward instead. Named here so the
   * gap between "paid ₹2,100" and "can refund ₹1,100" is explained rather
   * than looking like a bug.
   */
  creditPaidPaise: number;
  pendingPaise: number;
  /**
   * Razorpay-scoped, not the booking total.
   *
   * This box arranges money through Razorpay, so every line in it must be
   * about Razorpay. It used to show the total refunded across every method
   * — ₹1,15,000 sitting above "Paid through Razorpay ₹90,000", two numbers
   * that cannot be reconciled by anyone reading them.
   */
  gatewayRefundedPaise: number;
  /** Cash, UPI, bank transfer. Shown only to explain a lower ceiling. */
  otherRefundedPaise: number;
  /** What the booking still holds. The other half of the ceiling. */
  heldPaise: number;
  /**
   * What we actually owe: money held above what the booking costs.
   *
   * Distinct from refundablePaise, and the distinction matters. On a booking
   * that took ₹6,300, refunded ₹2,000 and now costs ₹4,200, we CAN send back
   * ₹4,300 and we OWE ₹100. The panel used to show only the ceiling, labelled
   * "Left to refund" — refund what it suggested and the booking is ₹4,200
   * short with two people still travelling.
   */
  owedPaise: number;
  hasOnlinePayment: boolean;
}) {
  const { run, pending, error } = useAction();
  // Starts at what is actually owed, not the ceiling — the common case is
  // returning exactly the overpayment, and a blank box invites typing the
  // bigger number sitting right above it.
  const [amount, setAmount] = useState(owedPaise > 0 ? String(owedPaise / 100) : "");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);

  const maxRupees = refundablePaise / 100;
  const entered = Number(amount || 0);
  const tooMuch = entered > maxRupees;

  if (!hasOnlinePayment) {
    return (
      <section className="rounded-[14px] border border-[#e3e7ee] bg-white p-5 shadow-sm">
        <h2 className="text-[0.95rem] font-semibold text-[#16203a]">Refund</h2>
        <p className="mt-1.5 text-[0.83rem] leading-relaxed text-[#5a6785]">
          Nothing on this booking was paid online, so there is nothing to send back
          through Razorpay. Return it the way it came in and note it against the booking.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[14px] border border-[#e3e7ee] bg-white p-5 shadow-sm">
      <h2 className="text-[0.95rem] font-semibold text-[#16203a]">Refund</h2>

      <dl className="mt-3 space-y-1 text-[0.83rem]">
        <div className="flex justify-between">
          <dt className="text-[#5a6785]">Paid through Razorpay</dt>
          <dd className="font-medium tabular-nums text-[#16203a]">
            {formatINR(toRupees(gatewayPaidPaise))}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[#5a6785]">Refunded through Razorpay</dt>
          <dd className="font-medium tabular-nums text-[#16203a]">
            {formatINR(toRupees(gatewayRefundedPaise))}
          </dd>
        </div>
        {pendingPaise > 0 && (
          <div className="flex justify-between">
            <dt className="text-[#8b6a00]">Awaiting Razorpay</dt>
            <dd className="font-medium tabular-nums text-[#8b6a00]">{formatINR(toRupees(pendingPaise))}</dd>
          </div>
        )}
        {/* Not Razorpay's business, but it is why the ceiling can be lower
            than the arithmetic above suggests. Muted, and named as separate. */}
        {otherRefundedPaise > 0 && (
          <div className="flex justify-between">
            <dt className="text-[#8b96ad]">Returned another way</dt>
            <dd className="tabular-nums text-[#8b96ad]">{formatINR(toRupees(otherRefundedPaise))}</dd>
          </div>
        )}
        {creditPaidPaise > 0 && (
          <div className="flex justify-between">
            <dt className="text-[#8b96ad]">Paid with travel credit</dt>
            <dd className="tabular-nums text-[#8b96ad]">
              {formatINR(toRupees(creditPaidPaise))}
            </dd>
          </div>
        )}
        <div className="flex justify-between border-t border-[#eef1f6] pt-1">
          <dt className="text-[#5a6785]">Can refund (max)</dt>
          <dd className="font-semibold tabular-nums text-[#16203a]">{formatINR(toRupees(refundablePaise))}</dd>
        </div>
        {creditPaidPaise > 0 && (
        <p className="mt-2 rounded-lg bg-[#f2f4f7] px-3 py-2 text-[0.8rem] leading-relaxed text-[#5a6785]">
          {formatINR(toRupees(creditPaidPaise))} of this booking was paid with travel credit.
          Razorpay never received it, so it can&apos;t be sent back — carry the booking forward
          to return it as credit instead.
        </p>
      )}

      {owedPaise > 0 && (
          <div className="flex justify-between">
            <dt className="font-medium text-[#b26a00]">Owed to the customer</dt>
            <dd className="font-semibold tabular-nums text-[#b26a00]">
              {formatINR(toRupees(owedPaise))}
            </dd>
          </div>
        )}
      </dl>

      {/* Two limits, and the ceiling is the smaller. When it's the booking
          rather than the gateway, the numbers above don't add up on their own
          — ₹90,000 in and ₹10,000 back, yet only ₹5,000 refundable. Say so. */}
      {pendingPaise === 0 &&
        refundablePaise > 0 &&
        heldPaise < gatewayPaidPaise - gatewayRefundedPaise && (
        <p className="mt-2 rounded-lg bg-[#f2f4f7] px-3 py-2 text-[0.8rem] leading-relaxed text-[#5a6785]">
          Razorpay could still send{" "}
          {formatINR(toRupees(gatewayPaidPaise - gatewayRefundedPaise))}, but this booking only
          holds {formatINR(toRupees(heldPaise))} — the rest has already gone back another way.
        </p>
        )}

      {owedPaise > 0 && (
        <p className="mt-2 rounded-lg bg-[#fdf1dc] px-3 py-2 text-[0.8rem] leading-relaxed text-[#7a4a00]">
          This booking is holding {formatINR(toRupees(owedPaise))} more than it costs — usually
          because a traveller came off and it was repriced. Refunding more than that leaves it
          underpaid.
        </p>
      )}

      {/* One refund at a time. While Razorpay hasn't answered, the ceiling
          below is a guess — and a second refund raised against a guess is how
          a booking ends up returning more than it took. */}
      {pendingPaise > 0 ? (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-[#f0dcae] bg-[#fdf1dc] px-3 py-2.5 text-[0.82rem] leading-relaxed text-[#7a4a00]"
        >
          <strong>{formatINR(toRupees(pendingPaise))} is already on its way back.</strong>{" "}
          Nothing else can be refunded until Razorpay confirms it — usually within a few
          minutes, occasionally a day.
        </p>
      ) : refundablePaise <= 0 ? (
        <p className="mt-3 text-[0.83rem] text-[#5a6785]">
          Everything paid on this booking has been refunded.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          <Field label="Amount (₹)">
            <Input
              type="number"
              min={1}
              max={maxRupees}
              value={amount}
              onChange={(v) => { setAmount(sanitiseAmountInput(v)); setConfirming(false); }}
              placeholder={String(Math.floor(maxRupees))}
            />
          </Field>
          <Field label="Reason (shown to the customer)">
            <Input value={reason} onChange={setReason} placeholder="e.g. Cancelled 14 days before" />
          </Field>

          {tooMuch && (
            <ErrorNote>
              That is more than the {formatINR(toRupees(refundablePaise))} left on this booking.
            </ErrorNote>
          )}
          {error && <ErrorNote>{error}</ErrorNote>}

          {confirming ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#f0dcae] bg-[#fdf6e3] px-3 py-2.5">
              <span className="text-[0.83rem] text-[#7a4a00]">
                Send {formatINR(entered)} back? This can&apos;t be undone here.
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(
                    () => refundBooking({ reference, amountRupees: entered, reason }),
                    () => { setAmount(""); setReason(""); setConfirming(false); },
                  )
                }
                className="ml-auto rounded-lg bg-[#a33] px-3 py-1.5 text-[0.82rem] font-medium text-white disabled:opacity-60"
              >
                {pending ? "Sending…" : "Yes, refund"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="text-[0.82rem] text-[#5a6785] underline underline-offset-2"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={pending || !entered || tooMuch}
              onClick={() => setConfirming(true)}
              className="w-full rounded-lg border border-[#a33]/30 bg-[#fdf3f3] px-3.5 py-2 text-[0.85rem] font-medium text-[#a33] transition hover:bg-[#fbe9e9] disabled:opacity-50"
            >
              Refund {entered ? formatINR(entered) : "…"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * "Nudge them now" — the manual counterpart to the nightly reminder.
 *
 * Sends the same email the cron would, so a customer never receives two
 * different-looking chases for the same money. Shown only when there is
 * actually a balance: a button whose only possible outcome is "nothing to
 * do" is worse than no button.
 */
export function ReminderPanel({
  reference,
  balancePaise,
  lastSentAt,
}: {
  reference: string;
  balancePaise: number;
  /** When a reminder last went out, so nobody nudges blind. */
  lastSentAt: Date | null;
}) {
  const { run, pending, error } = useAction();
  /**
   * The server's own words, shown as-is.
   *
   * It has two things to say — the reminder went to this address, or one had
   * already gone today and nothing was sent again. Reconstructing either from
   * a fragment here would mean the second click reporting a send that never
   * happened.
   */
  const [note, setNote] = useState<string | null>(null);

  if (balancePaise <= 0) return null;

  return (
    <section className="rounded-[14px] border border-[#e3e7ee] bg-white p-5 shadow-sm">
      <h2 className="text-[0.95rem] font-semibold text-[#16203a]">Balance reminder</h2>
      <p className="mt-1.5 text-[0.83rem] leading-relaxed text-[#5a6785]">
        {formatINR(toRupees(balancePaise))} outstanding. Reminders go out on their own as
        the trip approaches — this sends one now.
      </p>

      <p className="mt-2 text-[0.78rem] text-[#8b96ad]">
        {lastSentAt
          ? `Last sent ${lastSentAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
          : "No reminder sent yet."}
      </p>

      {error && <ErrorNote>{error}</ErrorNote>}
      {note && <p className="mt-2 text-[0.83rem] font-medium text-[#0f7a55]">{note}</p>}

      <button
        type="button"
        disabled={pending}
        onClick={() =>
          run(async () => {
            const res = await sendBalanceReminderNow(reference);
            if (res.ok) setNote(res.info ?? "Reminder sent.");
            return res;
          })
        }
        className="mt-3 w-full rounded-lg border border-[#e3e7ee] bg-[#f6f7f9] px-3.5 py-2 text-[0.85rem] font-medium text-[#16203a] transition hover:bg-[#eef1f6] disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send reminder now"}
      </button>

      <p className="mt-2 text-[0.72rem] leading-snug text-[#8b96ad]">
        One per day — clicking twice won&apos;t send twice.
      </p>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[0.72rem] font-semibold uppercase tracking-[0.09em] text-[#8b96ad]">
        {label}
      </span>
      {children}
    </label>
  );
}

const controlClass =
  "w-full rounded-lg border border-[#e3e7ee] bg-white px-3 py-[7px] text-[0.86rem] text-[#16203a] outline-none focus:border-teal";

function Input({
  value,
  onChange,
  placeholder,
  type,
  min,
  max,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Numeric inputs get the right keypad on a phone and the browser's own bounds. */
  type?: "text" | "number";
  min?: number;
  max?: number;
  /** For fields a chosen method makes meaningless — a UTR for travel credit. */
  disabled?: boolean;
}) {
  return (
    <input
      type={type ?? "text"}
      min={min}
      max={max}
      inputMode={type === "number" ? "decimal" : undefined}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={controlClass + (disabled ? " cursor-not-allowed bg-[#f3f5f8] text-[#9aa4b8]" : "")}
    />
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={controlClass}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="mb-3 flex items-start gap-2 rounded-lg border border-[#f0c9c9] bg-[#fdf5f5] px-3 py-2 text-[0.83rem] text-navy"
    >
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-none text-[#c33a3a]" />
      {children}
    </p>
  );
}


const RETURN_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI / GPay" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "OTHER", label: "Other" },
];

/**
 * Money the team gave back themselves.
 *
 * Deliberately a separate panel from the Razorpay one rather than a method
 * dropdown inside it, because almost nothing about the two is shared. A
 * gateway refund is a request that may sit pending for days and can fail;
 * this is a record of something that has already happened and cannot. The
 * ceilings differ too — Razorpay can only send back what it received, while
 * cash can be handed over regardless of how the money arrived.
 *
 * Folding them together would mean a form whose every field, limit and
 * outcome changed on one dropdown.
 */
export function OfflineRefundPanel({
  reference,
  heldPaise,
  pendingPaise = 0,
}: {
  reference: string;
  /**
   * What can still be handed back: paid, less every refund already promised
   * — landed or in flight — less credit carried forward.
   */
  heldPaise: number;
  /** Of that, how much is already travelling back through Razorpay. */
  pendingPaise?: number;
}) {
  const { run, pending, error } = useAction();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [ref, setRef] = useState("");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  /**
   * A note above the form, not instead of it.
   *
   * It used to replace the whole panel, so returning ₹1,000 of ₹1,990 left no
   * way to give back the rest without reloading — on a screen whose entire
   * job is handing money back in pieces.
   */
  const [done, setDone] = useState<string | null>(null);

  if (heldPaise <= 0 && pendingPaise <= 0) return null;

  const enteredPaise = Math.round((Number(amount) || 0) * 100);
  const overHeld = enteredPaise > heldPaise;
  const valid = enteredPaise > 0 && !overHeld;

  return (
    <section className="rounded-[14px] border border-[#e3e7ee] bg-white p-5 shadow-sm">
      <h2 className="text-[0.95rem] font-semibold text-[#16203a]">Returned by hand</h2>
      <p className="mt-1.5 text-[0.83rem] leading-relaxed text-[#5a6785]">
        Money you gave back yourself — cash, GPay, a bank transfer. Recorded as returned
        straight away; nothing is sent through Razorpay.
      </p>

      {error && <ErrorNote>{error}</ErrorNote>}
      {done && <p className="mt-2 text-[0.83rem] font-medium text-[#0f7a55]">{done}</p>}

      {/* Deliberately NOT blocked while a Razorpay refund is pending, unlike
          the box above.

          The ceiling already holds the in-flight money back, so the same
          rupees cannot go out twice — and this is the only route left when a
          webhook never lands. Freezing it would mean a stuck refund freezes
          the whole booking, with no way to settle with the customer at all. */}
      <>
          <div className="mt-3 flex justify-between text-[0.83rem]">
            <span className="text-[#5a6785]">Available to return</span>
            <span className="font-semibold tabular-nums text-[#16203a]">
              {formatINR(toRupees(heldPaise))}
            </span>
          </div>
          {pendingPaise > 0 && (
            <p className="mt-1.5 rounded-lg bg-[#fdf1dc] px-3 py-2 text-[0.79rem] leading-relaxed text-[#7a4a00]">
              A further {formatINR(toRupees(pendingPaise))}{" "}
              is on its way back through Razorpay and is already held out of the figure
              above — don&apos;t hand that part over as well.
            </p>
          )}
          {/* Say why it is lower than what the booking is holding, or the
              figure looks like it has lost money. */}

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Amount (₹)">
              <Input
                value={amount}
                onChange={(v) => {
                  setAmount(sanitiseAmountInput(v));
                  setConfirming(false);
                }}
                placeholder="0"
              />
            </Field>
            <Field label="How you returned it">
              <Select value={method} onChange={setMethod} options={RETURN_METHODS} />
            </Field>
          </div>

          {overHeld && (
            <p className="mt-1.5 text-[0.8rem] font-medium text-[#b3261e]">
              More than the {formatINR(toRupees(heldPaise))} still held.
            </p>
          )}

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Reference / UTR">
              <Input value={ref} onChange={setRef} placeholder="Optional" />
            </Field>
            <Field label="Reason (shown to the customer)">
              <Input value={reason} onChange={setReason} placeholder="Optional" />
            </Field>
          </div>

          {!confirming ? (
            <button
              type="button"
              disabled={pending || !valid}
              onClick={() => setConfirming(true)}
              className="mt-4 w-full rounded-lg border border-[#e3e7ee] bg-[#f6f7f9] px-3.5 py-2 text-[0.85rem] font-medium text-[#16203a] hover:bg-[#eef1f6] disabled:opacity-50"
            >
              Record refund
            </button>
          ) : (
            <div className="mt-4 rounded-lg border border-[#e3e7ee] bg-[#fbfcfd] p-3.5">
              <p className="text-[0.85rem] leading-relaxed text-[#16203a]">
                Record <strong>{formatINR(toRupees(enteredPaise))}</strong> returned by{" "}
                {RETURN_METHODS.find((m) => m.value === method)?.label.toLowerCase()}?
              </p>
              <p className="mt-1 text-[0.78rem] text-[#8b96ad]">
                The customer will be emailed. This assumes you have already given them the money.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(async () => {
                      const res = await recordOfflineRefund({
                        reference,
                        amountRupees: Number(amount),
                        method: method as "CASH",
                        externalReference: ref,
                        reason,
                      });
                      if (res.ok) {
                        setConfirming(false);
                        const info = "info" in res ? res.info : undefined;
                        setDone(typeof info === "string" ? info : "Recorded.");
                        // Cleared so the next amount starts from nothing
                        // rather than the one just recorded.
                        setAmount("");
                        setRef("");
                        setReason("");
                      }
                      return res;
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-3.5 py-2 text-[0.85rem] font-medium text-cream hover:bg-[#1b2f56] disabled:opacity-50"
                >
                  {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Yes, record it
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirming(false)}
                  className="rounded-lg border border-[#e3e7ee] px-3.5 py-2 text-[0.85rem] font-medium text-[#5a6785] hover:bg-[#f6f7f9] disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
      </>
    </section>
  );
}
