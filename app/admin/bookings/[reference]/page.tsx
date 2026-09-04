import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { requireAdmin } from "@/lib/auth";
import {
  checkoutInFlight,
  checkoutMinutesLeft,
  statusSettled,
} from "@/lib/booking/lifecycle";
import {
  committedGatewayRefundPaise,
  committedRefundPaise,
  pendingRefundPaise,
} from "@/lib/booking/refunds";
import { creditBalance } from "@/lib/credit/ledger";
import { getAdminBooking, rupees } from "@/lib/queries/admin";
import { formatDateRange, formatINR } from "@/lib/utils";
import { bookingTone, Chip, PAYMENT_TONE, Panel } from "../../ui";
import { prisma } from "@/lib/prisma";
import {
  DetailsPanel,
  PaymentPanel,
  RefundPanel,
  ReminderPanel,
  OfflineRefundPanel,
  StatusPanel,
} from "./BookingManager";

export const metadata = { title: "Booking" };

/** How a refund went back, for the team's own list. */
const REFUND_METHOD_LABEL: Record<string, string> = {
  RAZORPAY: "Razorpay",
  CASH: "Cash",
  UPI: "UPI / GPay",
  BANK_TRANSFER: "Bank transfer",
  OTHER: "Other",
};

const METHOD_LABEL: Record<string, string> = {
  CASH: "Cash",
  UPI_MANUAL: "UPI",
  BANK_TRANSFER: "Bank transfer",
  RAZORPAY: "Razorpay",
  OTHER: "Other",
  CREDIT: "Travel credit",
};

export default async function AdminBookingPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  await requireAdmin();
  const { reference } = await params;
  const booking = await getAdminBooking(decodeURIComponent(reference));
  if (!booking) notFound();

  /**
   * What this customer holds in travel credit, across every booking.
   *
   * Read here rather than inside the payment panel because the panel is a
   * client component: the balance is a SUM over the ledger and belongs on
   * the server, the same way the new-booking form gets it.
   */
  const creditAvailablePaise = await creditBalance(booking.profile.id);

  const status = bookingTone(booking);

  /**
   * A customer is in the Razorpay window on this booking right now.
   *
   * Everything that moves money, seats or status is refused for the rest of
   * the hold — see assertNotInCheckout() in the actions. The panels read
   * this so the refusal is on screen instead of arriving after a click.
   */
  const inCheckout = checkoutInFlight(booking);
  const checkoutMinsLeft = checkoutMinutesLeft(booking.holdExpiresAt);
  /**
   * The money, as three related figures rather than two unrelated ones.
   *
   *   netHeld    what we are actually holding: paid minus refunded. This is
   *              the number that reconciles against a bank balance, and the
   *              one every other figure should be measured from.
   *   balance    what the customer still owes.
   *   overpaid   what we owe them. A booking repriced after a traveller drops
   *              out ends up paid past its own total, which is not a bug and
   *              was previously invisible — "Balance ₹0" and a "Paid in full"
   *              badge on a booking holding ₹100 that isn't ours.
   *
   * Exactly one of balance/overpaid can be non-zero.
   */
  /**
   * Money carried out of this booking into the customer's credit ledger.
   *
   * It is no longer held against the booking — it belongs to the person now,
   * and spending it will happen on some future trip. Counting it here would
   * show the same rupees in two places.
   */
  const creditIssuedPaise = booking.creditIssued.reduce((n, c) => n + c.amountPaise, 0);

  /**
   * What Razorpay actually holds, as opposed to what the booking was paid.
   *
   * A booking settled with ₹1,100 by UPI and ₹1,000 of travel credit has
   * amountPaidPaise of ₹2,100, but Razorpay only ever received ₹1,100 — and
   * it cannot send back money it never took. Offering the difference was a
   * request destined to fail inside their API with a PENDING row already
   * written against it.
   */
  const gatewayGrossPaise = booking.payments
    .filter((p) => p.status === "CAPTURED" && p.method === "RAZORPAY" && p.razorpayPaymentId)
    .reduce((n, p) => n + p.amountPaise, 0);
  /**
   * Never more than the gateway holds, and never more than we credited.
   *
   * The two can differ, and in both directions. A booking part-paid with
   * credit was credited MORE than Razorpay ever received. And on older
   * bookings, taken before the fee-bearer change, payments.amount_paise is
   * the gross the card was charged — so Razorpay holds more than we were
   * ever given, the difference being their fee.
   *
   * The floor of the two is the only figure that is safe under both, which
   * matters because getting it wrong means either a refund Razorpay refuses
   * or one that returns money we never received.
   */
  const gatewayPaidPaise = Math.min(gatewayGrossPaise, booking.amountPaidPaise);
  const creditPaidPaise = booking.payments
    .filter((p) => p.status === "CAPTURED" && p.method === "CREDIT")
    .reduce((n, p) => n + p.amountPaise, 0);
  const netHeldPaise = booking.amountPaidPaise - booking.refundedPaise - creditIssuedPaise;

  /**
   * What can still be promised out — which is NOT what is still held.
   *
   * `netHeldPaise` counts only refunds that have PROCESSED, because that is
   * what "we still have their money" means. But a PENDING refund is already
   * spoken for: Razorpay has been asked and will send it. Offering it again
   * — in either refund box — hands the same rupees back twice.
   *
   * This is what both ceilings below are measured from. The held figure keeps
   * its own meaning for the balance, the overpayment and the stat cards.
   */
  const pendingRefundsPaise = pendingRefundPaise(booking.refunds);
  const refundableHeldPaise = Math.max(netHeldPaise - pendingRefundsPaise, 0);

  /**
   * A closed booking owes nothing in either direction.
   *
   * Without this, a carried-forward booking holding a ₹200 cancellation
   * charge against a ₹4,200 trip reports a ₹4,000 balance — money nobody
   * owes on a trip nobody is going on.
   */
  const settled = statusSettled(booking.status);
  const balancePaise = settled ? 0 : Math.max(booking.totalPaise - netHeldPaise, 0);
  const overpaidPaise = settled ? 0 : Math.max(netHeldPaise - booking.totalPaise, 0);
  // What customers paid ON TOP, per Razorpay's "customer pays the fee"
  // setting. Never added to the balance — this went straight to Razorpay and
  // was never DOT's. Zero for cash and for anything paid before the setting
  // was switched on.
  // When a reminder last went out — automated or manual. Shown so nobody
  // nudges someone who was emailed an hour ago.
  const lastReminderAt =
    (
      await prisma.emailLog.findFirst({
        where: { bookingId: booking.id, template: "balance_reminder", status: "SENT" },
        orderBy: { createdAt: "desc" },
        select: { sentAt: true, createdAt: true },
      })
    )?.sentAt ?? null;

  const feesCollected = booking.payments
    .filter((p) => p.status === "CAPTURED")
    .reduce((n, p) => n + p.convenienceFeePaise, 0);
  const paymentState =
    booking.amountPaidPaise === 0 ? "UNPAID" : balancePaise <= 0 ? "PAID" : "PARTIAL";
  const pay = PAYMENT_TONE[paymentState];
  const seatsCounted = ["REQUESTED", "CONFIRMED"].includes(booking.status);

  return (
    <>
      <header className="mb-6 flex flex-wrap items-start gap-4">
        <div className="min-w-0">
          <Link
            href={`/admin/trips/${booking.trip.id}/bookings`}
            className="mb-1 inline-flex items-center gap-1.5 text-[0.82rem] text-[#5a6785] hover:text-navy"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {booking.trip.title} bookings
          </Link>
          <h1 className="font-mono text-[1.35rem] font-semibold tracking-tight text-navy">
            {booking.reference}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[0.85rem] text-[#8b96ad]">
            <Chip tone={status.tone}>{status.label}</Chip>
            <Chip tone={pay.tone}>{pay.label}</Chip>
            <span>
              {booking.trip.batchName && `${booking.trip.batchName} · `}
              {formatDateRange(
                booking.trip.startDate.toISOString(),
                booking.trip.endDate.toISOString(),
              )}
            </span>
          </p>
        </div>

        <Link
          href={`/admin/customers/${booking.profile.id}`}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-[#e3e7ee] bg-white px-3.5 py-2 text-[0.85rem] hover:bg-[#eef1f6]"
        >
          {booking.profile.fullName ?? booking.profile.email}
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </header>

      <div className="mb-5 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Seats" value={String(booking.seats)} />
        <Stat label="Trip total" value={formatINR(rupees(booking.totalPaise))} />
        {/* Net, not gross. "Paid ₹6,300" on a booking where ₹2,000 has gone
            back overstates what we hold by exactly the refund. */}
        <Stat
          label="Held"
          value={formatINR(rupees(netHeldPaise))}
          sub={
            [
              `${formatINR(rupees(booking.amountPaidPaise))} paid`,
              booking.refundedPaise > 0 ? `${formatINR(rupees(booking.refundedPaise))} refunded` : null,
              creditIssuedPaise > 0 ? `${formatINR(rupees(creditIssuedPaise))} to credit` : null,
            ]
              .filter(Boolean)
              .join(" · ") || undefined
          }
          tone="ok"
        />
        {/* The fourth figure answers a different question depending on where
            the booking is.
            
            "Balance ₹0" on a cancelled booking is true and useless: nothing is
            owed because nobody is going, and the number says nothing about
            what happened to the money. On a closed booking the interesting
            figure is what was KEPT — which is the cancellation charge, by
            another name. */}
        {creditIssuedPaise > 0 ? (
          <Stat
            label="Carried forward"
            value={formatINR(rupees(creditIssuedPaise))}
            sub="to travel credit"
          />
        ) : settled ? (
          <Stat
            label={netHeldPaise > 0 ? "Retained" : "Settled"}
            value={formatINR(rupees(netHeldPaise))}
            sub={
              netHeldPaise > 0
                ? "kept from this booking"
                : "nothing owed either way"
            }
          />
        ) : (
          <Stat
            label={overpaidPaise > 0 ? "To refund" : "Balance"}
            value={formatINR(rupees(overpaidPaise > 0 ? overpaidPaise : balancePaise))}
            sub={overpaidPaise > 0 ? "held above the trip total" : undefined}
            tone={overpaidPaise > 0 || balancePaise > 0 ? "warn" : undefined}
          />
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.25fr_0.85fr] lg:items-start">
        <div>
          <DetailsPanel
            bookingId={booking.id}
            source={booking.source}
            internalNotes={booking.internalNotes}
            travellers={booking.travellers}
            // Removing a seat from an already-cancelled booking would give
            // the trip seats it never lost.
            canRemoveSeat={seatsCounted}
          />

          <Panel title={`Payments (${booking.payments.length})`}>
            {booking.payments.length === 0 ? (
              <p className="px-5 py-6 text-center text-[0.86rem] text-[#8b96ad]">
                Nothing received yet.
              </p>
            ) : (
              <ul className="divide-y divide-[#eef1f6]">
                {booking.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3">
                    <span className="font-display text-[1.05rem] font-semibold tabular-nums text-navy">
                      {formatINR(rupees(p.amountPaise))}
                    </span>
                    {/* The fee sits ON TOP, and the big figure beside it is
                        already what reached us.
                        
                        This used to read "→ booking ₹1,465 · fee ₹35" on a
                        ₹1,500 payment — written when the plan was for DOT to
                        charge the convenience fee out of the amount taken.
                        Razorpay's "customer pays the fee" setting inverts
                        that: the customer is charged the fee in addition, and
                        settlePayment credits the booking the full order
                        amount. So the only number the fee changes is what
                        appears on their card statement. */}
                    {p.convenienceFeePaise > 0 && (
                      <span className="text-[0.8rem] text-[#8b96ad]">
                        + {formatINR(rupees(p.convenienceFeePaise))} Razorpay fee · card charged{" "}
                        <b className="font-medium text-[#16203a]">
                          {formatINR(rupees(p.amountPaise + p.convenienceFeePaise))}
                        </b>
                      </span>
                    )}
                    <Chip tone="mute">{METHOD_LABEL[p.method] ?? p.method}</Chip>
                    {p.status !== "CAPTURED" && <Chip tone="warn">{p.status}</Chip>}
                    <span className="text-[0.8rem] text-[#8b96ad]">
                      {(p.capturedAt ?? p.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      {p.externalReference && ` · ${p.externalReference}`}
                      {p.recordedBy && ` · by ${p.recordedBy.fullName ?? p.recordedBy.email}`}
                    </span>
                    {p.notes && (
                      <span className="w-full text-[0.8rem] text-[#5a6785]">{p.notes}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {feesCollected > 0 && (
              <div className="border-t border-[#eef1f6] px-5 py-3 text-[0.83rem]">
                <div className="flex items-baseline justify-between">
                  <span className="text-[#5a6785]">Toward this booking</span>
                  <b className="tabular-nums text-[#16203a]">
                    {formatINR(rupees(booking.amountPaidPaise))}
                  </b>
                </div>
                {/* Deliberately below the booking total and greyed: this is
                    not income. Seeing it beside the trip amount is what makes
                    that obvious at a glance. */}
                <div className="mt-1 flex items-baseline justify-between text-[#8b96ad]">
                  <span>Razorpay fee paid by customers</span>
                  <span className="tabular-nums">{formatINR(rupees(feesCollected))}</span>
                </div>
              </div>
            )}
          </Panel>

          <Panel title="Price breakdown">
            <dl className="px-5 py-4 text-[0.88rem]">
              <Line
                label={`${formatINR(rupees(booking.unitPricePaise))} × ${booking.seats}`}
                value={formatINR(rupees(booking.subtotalPaise))}
              />
              <Line label={`GST ${booking.gstPercent}%`} value={formatINR(rupees(booking.gstPaise))} />
              {booking.tcsPercent > 0 && (
                <Line label={`TCS ${booking.tcsPercent}%`} value={formatINR(rupees(booking.tcsPaise))} />
              )}
              <div className="mt-2 flex items-baseline justify-between border-t border-[#eef1f6] pt-2">
                <dt className="font-medium text-navy">Total</dt>
                <dd className="font-display text-lg tabular-nums text-navy">
                  {formatINR(rupees(booking.totalPaise))}
                </dd>
              </div>
              {booking.trip.advancePaise && (
                <p className="mt-2 text-[0.78rem] text-[#8b96ad]">
                  Advance for this party:{" "}
                  {formatINR(rupees(booking.trip.advancePaise * booking.seats))}
                </p>
              )}
            </dl>
          </Panel>

          {/* Every refund, including the failed ones.
              
              A FAILED row was invisible anywhere in the admin — you could not
              tell a refund that was tried and rejected from one that was
              never raised, which is exactly the question asked when a
              customer says the money hasn't arrived. */}
          {booking.refunds.length > 0 && (
            <Panel title={`Refunds (${booking.refunds.length})`}>
              <ul className="divide-y divide-[#f2f4f7]">
                {booking.refunds.map((r) => (
                  <li key={r.id} className="px-5 py-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-display text-[0.95rem] font-semibold tabular-nums text-[#16203a]">
                        − {formatINR(rupees(r.amountPaise))}
                      </span>
                      <Chip tone="mute">{REFUND_METHOD_LABEL[r.method] ?? r.method}</Chip>
                      <Chip
                        tone={
                          r.status === "PROCESSED" ? "ok" : r.status === "FAILED" ? "bad" : "warn"
                        }
                      >
                        {r.status === "PROCESSED"
                          ? "Sent"
                          : r.status === "FAILED"
                            ? "Failed"
                            : "Awaiting Razorpay"}
                      </Chip>
                      <span className="ml-auto whitespace-nowrap text-[0.8rem] text-[#8b96ad]">
                        {(r.processedAt ?? r.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    {(r.reason || r.externalReference || r.failureReason || r.initiatedBy) && (
                      <p className="mt-1 text-[0.8rem] text-[#8b96ad]">
                        {[
                          r.reason,
                          r.externalReference,
                          r.failureReason,
                          r.initiatedBy
                            ? `by ${r.initiatedBy.fullName ?? r.initiatedBy.email}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              <div className="flex items-baseline justify-between border-t border-[#eef1f6] px-5 py-3 text-[0.88rem]">
                <span className="font-medium text-navy">Refunded in total</span>
                <span className="font-display text-lg tabular-nums text-navy">
                  {formatINR(rupees(booking.refundedPaise))}
                </span>
              </div>
            </Panel>
          )}

          {/* Timeline lives with the record, not with the controls.
              
              It used to sit at the foot of the right-hand column, which held
              six panels to this column's three — so the actions ran a screen
              longer than the facts and left a large empty block beside them.
              It is also read-only: nothing here is something you DO to the
              booking, which is what the right column is for. */}
          <Panel title="Timeline">
            <ul className="px-5 py-4 text-[0.83rem] text-[#5a6785]">
              <TimeRow label="Booked" at={booking.createdAt} />
              <TimeRow label="Confirmed" at={booking.confirmedAt} />
              <TimeRow
                label={booking.status === "CARRIED_FORWARD" ? "Carried forward" : "Cancelled"}
                at={booking.cancelledAt}
                // The reason belonged to its own panel, which rendered as a
                // heading above one orphaned line. It means nothing apart
                // from the date it attaches to.
                note={booking.cancellationReason}
              />
            </ul>
          </Panel>
        </div>

        <div>
          <PaymentPanel
            inCheckout={inCheckout}
            checkoutMinsLeft={checkoutMinsLeft}
            bookingId={booking.id}
            balancePaise={Math.max(balancePaise, 0)}
            customerName={booking.profile.fullName ?? booking.profile.email}
            creditPaise={creditAvailablePaise}
          />

          {/* Only PROCESSED refunds have actually left the account; PENDING
              ones are with Razorpay. Both are held back from the refundable
              ceiling so a second refund can't be raised against money that is
              already on its way out. */}
          <RefundPanel
            reference={booking.reference}
            owedPaise={overpaidPaise}
            // Razorpay-scoped, because this box only arranges Razorpay money.
            gatewayRefundedPaise={committedGatewayRefundPaise(booking.refunds)}
            otherRefundedPaise={
              committedRefundPaise(booking.refunds) -
              committedGatewayRefundPaise(booking.refunds)
            }
            heldPaise={refundableHeldPaise}
            pendingPaise={pendingRefundsPaise}
            gatewayPaidPaise={gatewayPaidPaise}
            creditPaidPaise={creditPaidPaise}
            refundablePaise={
              /**
               * Two independent limits, and the smaller wins.
               *
               * Razorpay can only send back what IT received, less what has
               * already gone back through IT — offline refunds don't touch
               * that, because handing over cash takes nothing out of the
               * gateway. Subtracting them here reported ₹0 refundable on a
               * booking where Razorpay still held ₹90.
               *
               * And the whole booking cannot return more than it holds, which
               * is where offline refunds and carried-forward credit do count.
               */
              Math.max(
                Math.min(
                  gatewayPaidPaise - committedGatewayRefundPaise(booking.refunds),
                  refundableHeldPaise,
                ),
                0,
              )
            }
            hasOnlinePayment={booking.payments.some(
              (p) => p.method === "RAZORPAY" && p.status === "CAPTURED" && p.razorpayPaymentId,
            )}
          />
          <OfflineRefundPanel
            reference={booking.reference}
            heldPaise={refundableHeldPaise}
            pendingPaise={pendingRefundsPaise}
          />

          <StatusPanel
            inCheckout={inCheckout}
            checkoutMinsLeft={checkoutMinsLeft}
            bookingId={booking.id}
            reference={booking.reference}
            status={booking.status}
            seatsCounted={seatsCounted}
            customerEmail={booking.profile.email ?? booking.travellers[0]?.email ?? null}
            customerName={booking.profile.fullName ?? booking.profile.email}
            amountPaidPaise={booking.amountPaidPaise}
            refundedPaise={booking.refundedPaise}
            // Money Razorpay has been asked for and not yet confirmed. It
            // blocks carry-forward — the same rupees can't go back to their
            // bank and become credit here.
            pendingRefundPaise={booking.refunds
              .filter((r) => r.status === "PENDING")
              .reduce((n, r) => n + r.amountPaise, 0)}
          />

          <ReminderPanel
            reference={booking.reference}
            balancePaise={Math.max(balancePaise, 0)}
            lastSentAt={lastReminderAt}
          />

        </div>
      </div>
    </>
  );
}

function TimeRow({ label, at, note }: { label: string; at: Date | null; note?: string | null }) {
  if (!at) return null;
  return (
    <li className="flex justify-between gap-3 py-1">
      <span>
        {label}
        {note && <span className="mt-0.5 block text-[0.78rem] text-[#8b96ad]">{note}</span>}
      </span>
      <span className="tabular-nums text-navy">
        {at.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
      </span>
    </li>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-3">
      <dt className="text-[#5a6785]">{label}</dt>
      <dd className="tabular-nums text-navy">{value}</dd>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  /** The working underneath the figure — "₹6,300 paid · ₹2,000 refunded". */
  sub?: string;
  tone?: "ok" | "warn";
}) {
  const colour = tone === "ok" ? "text-[#0f8a5f]" : tone === "warn" ? "text-[#b26a00]" : "";
  return (
    <div className="rounded-[14px] border border-[#e3e7ee] bg-white p-[15px_18px] shadow-sm">
      <div className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-[#8b96ad]">
        {label}
      </div>
      <div className={`mt-1.5 font-display text-[1.5rem] font-semibold tabular-nums ${colour}`}>
        {value}
      </div>
      {sub && <div className="mt-1 text-[0.75rem] leading-snug text-[#8b96ad]">{sub}</div>}
    </div>
  );
}
