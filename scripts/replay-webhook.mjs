/**
 * Replays a Razorpay webhook against the local app, correctly signed.
 *
 *   node --env-file=.env.local scripts/replay-webhook.mjs DOT-KO26-0002
 *   node --env-file=.env.local scripts/replay-webhook.mjs DOT-KO26-0002 --fresh
 *   node --env-file=.env.local scripts/replay-webhook.mjs DOT-KO26-0002 --event=order.paid
 *
 * Razorpay's dashboard doesn't reliably expose a "resend" button in test
 * mode, and waiting for a real retry means waiting hours. This builds the
 * same payload they send, signs it with RAZORPAY_WEBHOOK_SECRET, and POSTs
 * it — so the route cannot tell it apart from the real thing.
 *
 * ── The two things worth replaying ──
 *
 * Default (stable event id) reproduces a RETRY: byte-identical to a delivery
 * already seen. It should die at the unique index on razorpay_events.event_id
 * before any handler runs, and answer 200 so Razorpay stops trying.
 *
 * --fresh reproduces a DIFFERENT event for a payment already settled — which
 * is what order.paid landing after payment.captured actually looks like. The
 * event row is new, the handler does run, and settlePayment's conditional
 * claim is what has to stop it. A completely different defence, and the one
 * that would actually double-credit a booking if it were broken.
 *
 * The amount and ids come from the database rather than the command line, so
 * a replay always describes a payment that really happened.
 */
import { createHmac, randomUUID } from "node:crypto";
import pg from "pg";

const args = process.argv.slice(2);
const reference = args.find((a) => !a.startsWith("--"));
const fresh = args.includes("--fresh");
const event = (args.find((a) => a.startsWith("--event="))?.split("=")[1] ?? "payment.captured").trim();
const base = process.env.APP_URL ?? "http://localhost:3009";

if (!reference) {
  console.error("usage: replay-webhook.mjs <BOOKING-REFERENCE> [--fresh] [--event=payment.captured]");
  process.exit(1);
}

const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
if (!secret) {
  console.error("RAZORPAY_WEBHOOK_SECRET is not set — run with --env-file=.env.local");
  process.exit(1);
}

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

const { rows } = await c.query(
  `SELECT p.razorpay_order_id, p.razorpay_payment_id, p.amount_paise, p.status::text,
          b.reference, b.amount_paid_paise, b.status::text AS booking_status
     FROM payments p JOIN bookings b ON b.id = p.booking_id
    WHERE b.reference = $1 AND p.razorpay_payment_id IS NOT NULL
    ORDER BY p.captured_at DESC NULLS LAST LIMIT 1`,
  [reference],
);
await c.end();

const p = rows[0];
if (!p) {
  console.error(`No captured Razorpay payment found on ${reference}.`);
  process.exit(1);
}

// A stable id makes a rerun a genuine duplicate; a random one makes it a
// new event for a payment that is already settled.
const eventId = fresh ? `evt_replay_${randomUUID().slice(0, 12)}` : `evt_replay_${p.razorpay_payment_id}`;

const body = JSON.stringify({
  entity: "event",
  account_id: "acc_test",
  event,
  contains: ["payment"],
  payload: {
    payment: {
      entity: {
        id: p.razorpay_payment_id,
        entity: "payment",
        amount: p.amount_paise,
        currency: "INR",
        status: "captured",
        order_id: p.razorpay_order_id,
        method: "card",
      },
    },
  },
  created_at: Math.floor(Date.now() / 1000),
});

// Signed over the exact bytes being sent. Re-serialising would change them.
const signature = createHmac("sha256", secret).update(body).digest("hex");

console.log(`replaying ${event}  →  ${base}/api/webhooks/razorpay`);
console.log(`  booking   ${p.reference}  (${p.booking_status}, paid ₹${p.amount_paid_paise / 100})`);
console.log(`  order     ${p.razorpay_order_id}`);
console.log(`  payment   ${p.razorpay_payment_id}  ₹${p.amount_paise / 100}`);
console.log(`  event id  ${eventId}  ${fresh ? "(FRESH — new event, already-settled payment)" : "(STABLE — a true retry)"}`);

const res = await fetch(`${base}/api/webhooks/razorpay`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-razorpay-signature": signature,
    "x-razorpay-event-id": eventId,
  },
  body,
});

console.log(`\n  HTTP ${res.status}   ${await res.text()}`);
