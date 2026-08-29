"use client";

import { PhoneInput } from "@/components/shared/PhoneInput";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertCircle, Check, IndianRupee, Loader2, Pencil, Trash2, X } from "lucide-react";

// toRupees, not the identical `rupees` from queries/admin: that module is
// server-only and importing it here drags Prisma and pg into the browser
// bundle, which fails the build.
import { toRupees } from "@/lib/booking/pricing";
import { formatINR } from "@/lib/utils";
import { BOOKING_TONE, Chip, Panel } from "../../ui";
import {
  cancelSeat,
  recordPayment,
  refundBooking,
  sendBalanceReminderNow,
  updateBookingDetails,
  updateBookingStatus,
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

  const submit = () =>
    run(
      () => recordPayment({ bookingId, method: method as "CASH", amountPaise: amount, externalReference: reference, notes }),
      () => {
        setAmount("");
        setReference("");
        setNotes("");
      },
    );

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
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="19999"
                className="w-full border-0 bg-transparent text-[0.88rem] outline-none"
              />
            </div>
            {balancePaise > 0 && (
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
          disabled={pending || !amount.trim()}
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
  status,
  seatsCounted,
  customerEmail,
}: {
  bookingId: string;
  status: string;
  seatsCounted: boolean;
  /** Shown on the confirm step so nobody emails the wrong person. */
  customerEmail: string | null;
}) {
  const { run, pending, error } = useAction();
  const [next, setNext] = useState(status);
  const [reason, setReason] = useState("");
  /**
   * The second click.
   *
   * Deliberately a step in the panel rather than window.confirm(): a native
   * dialog can only carry one line of text, and the thing worth reading here
   * is a list — the seat movement, the email, and who it goes to. It also
   * resets whenever the chosen status changes, so a confirmation can never
   * be left over from a status the admin has since changed their mind about.
   */
  const [confirming, setConfirming] = useState(false);

  const cancelling = next === "CANCELLED";
  const changed = next !== status;
  const willEmail = STATUS_EMAIL[next];

  return (
    <Panel title="Status">
      <div className="px-5 py-4">
        {error && <ErrorNote>{error}</ErrorNote>}

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
                <strong>{customerEmail ?? "The customer"}</strong> will be emailed {willEmail}.
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
            disabled={pending || !changed}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-navy px-3.5 py-2 text-[0.85rem] font-medium text-cream hover:bg-[#1b2f56] disabled:opacity-50"
          >
            Update status
          </button>
        ) : (
          <div className="mt-4 rounded-lg border border-[#e3e7ee] bg-[#fbfcfd] p-3.5">
            <p className="text-[0.85rem] leading-relaxed text-[#16203a]">
              Change status to <strong>{BOOKING_TONE[next]?.label ?? next}</strong>
              {willEmail ? (
                <>
                  {" "}
                  and email {customerEmail ?? "the customer"} {willEmail}?
                </>
              ) : (
                "?"
              )}
            </p>
            {willEmail && (
              <p className="mt-1 text-[0.78rem] text-[#8b96ad]">
                This can&apos;t be unsent.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  run(async () => {
                    const res = await updateBookingStatus({
                      bookingId,
                      status: next as "CONFIRMED",
                      reason,
                    });
                    if (res.ok) setConfirming(false);
                    return res;
                  })
                }
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-3.5 py-2 text-[0.85rem] font-medium text-cream hover:bg-[#1b2f56] disabled:opacity-50"
              >
                {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {willEmail ? "Update & send email" : "Update status"}
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
  hasOnlinePayment,
}: {
  reference: string;
  /** The CEILING — every rupee still sitting with us on this booking. */
  refundablePaise: number;
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
        <div className="flex justify-between border-t border-[#eef1f6] pt-1">
          <dt className="text-[#5a6785]">Can refund (max)</dt>
          <dd className="font-semibold tabular-nums text-[#16203a]">{formatINR(toRupees(refundablePaise))}</dd>
        </div>
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
              onChange={(v) => { setAmount(v); setConfirming(false); }}
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
