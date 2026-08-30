"use client";

import { PhoneInput } from "@/components/shared/PhoneInput";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertCircle, Check, IndianRupee, Loader2, Pencil, Trash2, X } from "lucide-react";

// toRupees, not the identical `rupees` from queries/admin: that module is
// server-only and importing it here drags Prisma and pg into the browser
// bundle, which fails the build.
import { toRupees } from "@/lib/booking/pricing";
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

const STATUSES = Object.entries(BOOKING_TONE).map(([value, v]) => ({ value, label: v.label }));

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

export function PaymentPanel({
  bookingId,
  balancePaise,
}: {
  bookingId: string;
  balancePaise: number;
}) {
  const { run, pending, error } = useAction();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const enteredPaise = Math.round((Number(amount) || 0) * 100);
  const overBalance = enteredPaise > balancePaise;

  const submit = () =>
    run(
      () => recordPayment({ bookingId, method: method as "CASH", amountPaise: amount, externalReference: reference, notes }),
      () => {
        setAmount("");
        setReference("");
        setNotes("");
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
            {overBalance ? (
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
            <Select value={method} onChange={setMethod} options={METHODS} />
          </Field>

          <Field label="Reference / UTR">
            <Input value={reference} onChange={setReference} placeholder="Optional" />
          </Field>
          <Field label="Note">
            <Input value={notes} onChange={setNotes} placeholder="Optional" />
          </Field>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={pending || !amount.trim() || overBalance}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-navy px-3.5 py-2 text-[0.85rem] font-medium text-cream hover:bg-[#1b2f56] disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Record payment
        </button>
        <p className="mt-2 text-[0.78rem] text-[#8b96ad]">
          Adds to the paid total and recalculates the balance. A request becomes confirmed on its
          first payment.
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
const STATUS_EMAIL: Record<string, string> = {
  CONFIRMED: "a booking confirmation",
  CANCELLED: "a cancellation notice",
};

export function StatusPanel({
  bookingId,
  reference,
  status,
  seatsCounted,
  customerEmail,
  customerName,
  amountPaidPaise,
  refundedPaise,
}: {
  bookingId: string;
  reference: string;
  status: string;
  seatsCounted: boolean;
  /** Shown on the confirm step so nobody emails the wrong person. */
  customerEmail: string | null;
  customerName: string;
  amountPaidPaise: number;
  refundedPaise: number;
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
  const canSubmit = changed && (!carrying || creditValid) && !done;

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

        {/* Carrying forward needs an amount, so the extra fields appear here
            rather than behind a second button. The status IS the decision;
            these are its terms. */}
        {carrying && (
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

        {changed && (
          <p className="mt-3 rounded-lg bg-[#fdf1dc] px-3 py-2 text-[0.8rem] leading-relaxed text-[#7a4a00]">
            {seatsCounted && !["REQUESTED", "CONFIRMED"].includes(next)
              ? "Seats will be released back to the trip."
              : !seatsCounted && ["REQUESTED", "CONFIRMED"].includes(next)
                ? "Seats will be taken from the trip — this fails if it's now full."
                : "Seat count is unchanged."}
          </p>
        )}

        {changed && (
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
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={pending || !canSubmit}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-navy px-3.5 py-2 text-[0.85rem] font-medium text-cream hover:bg-[#1b2f56] disabled:opacity-50"
          >
            Update status
          </button>
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
                className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-3.5 py-2 text-[0.85rem] font-medium text-cream hover:bg-[#1b2f56] disabled:opacity-50"
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
  refundedPaise,
  owedPaise,
  gatewayPaidPaise,
  creditPaidPaise,
  hasOnlinePayment,
}: {
  reference: string;
  /** The CEILING — what Razorpay still holds and could send back. */
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
  refundedPaise: number;
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
          <dt className="text-[#5a6785]">Already refunded</dt>
          <dd className="font-medium tabular-nums text-[#16203a]">{formatINR(toRupees(refundedPaise))}</dd>
        </div>
        {pendingPaise > 0 && (
          <div className="flex justify-between">
            <dt className="text-[#8b6a00]">Awaiting Razorpay</dt>
            <dd className="font-medium tabular-nums text-[#8b6a00]">{formatINR(toRupees(pendingPaise))}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-[#5a6785]">Paid through Razorpay</dt>
          <dd className="font-medium tabular-nums text-[#16203a]">
            {formatINR(toRupees(gatewayPaidPaise))}
          </dd>
        </div>
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

      {owedPaise > 0 && (
        <p className="mt-2 rounded-lg bg-[#fdf1dc] px-3 py-2 text-[0.8rem] leading-relaxed text-[#7a4a00]">
          This booking is holding {formatINR(toRupees(owedPaise))} more than it costs — usually
          because a traveller came off and it was repriced. Refunding more than that leaves it
          underpaid.
        </p>
      )}

      {refundablePaise <= 0 ? (
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
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Numeric inputs get the right keypad on a phone and the browser's own bounds. */
  type?: "text" | "number";
  min?: number;
  max?: number;
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
      className={controlClass}
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
}: {
  reference: string;
  /** Everything still with us: paid, less refunds, less credit carried forward. */
  heldPaise: number;
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

  if (heldPaise <= 0) return null;

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

      <>
          <div className="mt-3 flex justify-between text-[0.83rem]">
            <span className="text-[#5a6785]">Still held on this booking</span>
            <span className="font-semibold tabular-nums text-[#16203a]">
              {formatINR(toRupees(heldPaise))}
            </span>
          </div>

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
