# Payments

How money moves through this app, and why it is built this way.

Read this before changing anything in `lib/payments/` — most of the design
exists to survive a specific failure that has already been tested for.

---

## The core idea: hold, then count

Between "customer clicks Pay" and "money arrives" there is anywhere from 30
seconds to 15 minutes. Two naive options both break:

- Count the seat immediately → every abandoned checkout burns one
- Don't count it → two people buy the last seat

So seats move in two phases:

| Phase | Function | Effect |
|---|---|---|
| Hold | `reserve_seats(trip, profile, seats, minutes)` | Inserts a `seat_holds` row. **`trips.seats_booked` does not change.** |
| Count | `confirm_seat_hold(holdId, bookingId)` | Increments `seats_booked`, links the hold to the booking |

Availability is computed live and subtracts unexpired holds:

```sql
-- trip_seats_available()
total_seats − seats_booked − SUM(holds WHERE expires_at > now())
```

A held seat is therefore **unavailable without being sold**.

### Seats free themselves

Because that filter is `expires_at > now()`, a lapsed hold stops blocking at
the exact second it expires. **No job is involved.** The cron
(`/api/cron/release-holds`, every 10 min) only does bookkeeping: stamping
`released_at` and flipping dead bookings to `EXPIRED`.

If the cron stopped for a week, seats would still free themselves on time —
you would just accumulate stale `PENDING_PAYMENT` rows in the admin list.
That separation is deliberate: the thing protecting the money does not depend
on a scheduler firing.

`HOLD_MINUTES` (15) lives in `lib/payments/createOrder.ts`. It is matched to
Razorpay's own transaction timeout, which is 3–15 minutes.

---

## The four ways a payment can arrive

`settlePayment()` branches on one question: **does the booking still point at
a usable hold?** All four rows below are covered by tests.

| | Cause | State on arrival | Branch | Outcome |
|---|---|---|---|---|
| **A** | Paid within 15 min — *99% of payments* | hold live | `confirm_seat_hold()` | seat counted, `CONFIRMED` |
| **B** | UPI approved at minute 17; cron has not swept yet | hold lapsed, `pendingHoldId` still set | `confirm_seat_hold()` | seat counted, `CONFIRMED` |
| **C** | Webhook retried for 40 min after a deploy | hold released, `pendingHoldId` NULL | direct `UPDATE trips` | seat counted, `CONFIRMED` |
| **D** | Same as C, but the trip filled meanwhile | hold released, trip full | direct `UPDATE trips` | **not oversold**, parked `REQUESTED` |

**Path B** works because `confirm_seat_hold` forgives an expired hold when
there is still room. It refuses only when expired *and* full. Being two
minutes late costs nothing.

**Paths C and D** are what Razorpay calls **Late Auth** — the bank authorises
after the order session expired on our side. Before this was handled, a late
payment marked the booking `CONFIRMED` without ever incrementing
`seats_booked`: the trip believed it still had a seat it had actually sold.
Silent oversell. The direct claim is guarded so it can only ever take a seat
that exists:

```sql
UPDATE trips SET seats_booked = seats_booked + n
 WHERE id = ... AND seats_booked + n <= total_seats
```

Zero rows changed means the trip is genuinely full — **path D**. There is no
correct automatic answer there: refunding silently would be worse than
telling someone.

### What path D does, and what the customer sees

The money is recorded, the booking sits as `REQUESTED`, `internal_notes`
explains it, and **two emails go out immediately**:

| To | Template | Says |
|---|---|---|
| The customer | `booking_seat_unavailable` | Payment received, seat gone, it's our fault, your money is safe, we'll call within a working day with the next departure or a full refund |
| The team | `admin_seat_unavailable` | Booking reference, amount, customer contact, and a link straight to the admin booking screen |

`REQUESTED` normally means "we'll ring you to collect payment" — which is
exactly the wrong thing to say to someone who has already paid. So the
customer-facing status is derived from the amount paid, not the status alone
(`statusFor()` in `app/account/bookings/[reference]/page.tsx`):

- `REQUESTED` + `amount_paid_paise = 0` → *"Request received. Our team will contact you to arrange payment."*
- `REQUESTED` + `amount_paid_paise > 0` → *"Payment received. The last seat was taken moments before it reached us…"*

The booking form surfaces the same thing inline, because someone who has just
paid deserves a plain sentence rather than a coloured badge.

### What path C looks like to the customer

The end state is right, but the middle is worth knowing about. She pays at
10:00; the webhook is retried and only lands at 10:40:

| Time | Status | Page says |
|---|---|---|
| 10:00 | `PENDING_PAYMENT` | "Your seats are held until payment comes through." |
| 10:15 | `PENDING_PAYMENT` | same — hold lapsed, cron hasn't run |
| 10:20 | `EXPIRED` | **she paid 20 minutes ago and sees this** |
| 10:40 | `CONFIRMED` | "You're in." — seat counted, confirmation email sent |

Nothing is lost, and it resolves itself. But between 10:20 and 10:40 the
customer is looking at a page about a payment they know they made, so the
EXPIRED copy is written for both readers: it states plainly that payment
wasn't received, then adds that a payment already made can take a few
minutes to arrive and will confirm itself.

If this window ever becomes a real support burden, the fix is a
reconciliation job: for bookings we believe are unpaid but that hold a
Razorpay order, ask Razorpay directly rather than waiting for their retry.
That was deliberately left out of the first build.

---

## Idempotency: four independent layers

Razorpay retries a failed delivery with exponential backoff **for 24 hours**,
and events can arrive **out of order** (`payment.captured` before
`order.paid`). Nothing may be counted twice.

| Layer | Mechanism | Catches |
|---|---|---|
| 1 | `razorpay_events.event_id` UNIQUE | A retried delivery of the same event |
| 2 | `payments.razorpay_payment_id` UNIQUE | One payment credited to two bookings |
| 3 | The conditional claim (below) | Browser callback racing the webhook |
| 4 | `confirm_seat_hold` requires `booking_id IS NULL` | A replayed hold confirmation |

None depends on the others. No single one has to be perfect.

### The claim

```sql
UPDATE payments SET status='CAPTURED'
 WHERE id = $1 AND status <> 'CAPTURED'
```

Under READ COMMITTED, a second concurrent transaction blocks on the row lock,
then **re-evaluates its WHERE against the committed row**. It matches nothing
and reports zero rows changed. Exactly one caller wins, and the `UPDATE` is
itself the mutex — no advisory lock, no `SELECT FOR UPDATE`.

---

## Two entry points, one settlement

Both are our own routes. Neither is a Razorpay API.

| Route | Called by | Purpose |
|---|---|---|
| `POST /api/payments/verify` | The customer's browser | **Speed only.** Confirms in ~200ms so they don't watch a spinner |
| `POST /api/webhooks/razorpay` | Razorpay's servers | **Authoritative.** Works when the tab is closed |

Delete the verify route and every booking still confirms, just seconds later.
Delete the webhook and a customer who closes their tab never gets their seat.

Both call `settlePayment()`, which is safe to run any number of times from
either direction, simultaneously.

### Signature verification

Two different signatures, two different secrets:

| What | Signed over | Key |
|---|---|---|
| Webhook | The **raw request body** | `RAZORPAY_WEBHOOK_SECRET` |
| Browser callback | `order_id + "|" + payment_id` | `RAZORPAY_KEY_SECRET` |

**The webhook route must read `await request.text()`**, never
`request.json()`. Parsing and re-serialising changes the bytes — key order,
whitespace — and the digest will never match. Tested: pretty-printed and
key-reordered bodies both fail verification.

Comparison is constant-time (`timingSafeEqual`). A plain `===` on a hex
digest short-circuits at the first wrong character, which over enough
attempts leaks the signature one character at a time.

---

## Reuse and supersede

`createPaymentOrder` never blindly creates a second booking:

- **Same seat count** → returns the existing order, and **refreshes the hold**
  to a full window. Without this, clicking Pay at minute 14 gives a 60-second
  window inside Razorpay's popup. The refresh only ever extends, never shortens.
- **Different seat count** → releases the old hold and takes a new one **in the
  same transaction**, so there is never an instant where both are held. The old
  booking becomes `EXPIRED` with a note, and its order is marked `FAILED`.

Without the supersede, going from 1 seat to 2 left the first hold live and the
customer silently occupied three seats while able to pay for two.

---

## Refunds

Append-only, like payments. `refunds` is its own table because
`payments.razorpay_refund_id` is a single column — one partial refund is
expressible, two are not.

Two halves:

- `requestRefund()` records the intent (`PENDING`) **before** calling Razorpay,
  then asks them. A process that dies mid-request leaves a recoverable row; a
  successful refund with no local record would not be.
- `applyRefundEvent()` reacts to `refund.processed` / `refund.failed`.

`bookings.refunded_paise` is written **only** on the PROCESSED transition, and
is recomputed as the sum of PROCESSED rows rather than incremented — so it
cannot drift from its own parts. It means "left our account", not "we asked".

A database trigger (`refunds_within_paid`) enforces that the sum of non-FAILED
refunds never exceeds `amount_paid_paise`. It is a trigger, not a CHECK,
because a CHECK cannot aggregate across rows. FAILED refunds are excluded —
that money never left, so it must stay refundable.

---

## Where things live

```
lib/payments/
  client.ts        Lazy SDK singleton. Missing keys fail at checkout, not at import
  signature.ts     Both HMACs, constant-time
  createOrder.ts   Hold → booking → Razorpay order. HOLD_MINUTES lives here
  settle.ts        The single idempotent settlement path
  refunds.ts       Request + webhook application

app/api/
  webhooks/razorpay/route.ts   Authoritative
  payments/verify/route.ts     Browser callback
  cron/release-holds/route.ts  Bookkeeping, every 10 min via vercel.json

scripts/payment-state.mjs      Prints every table a payment touches
```

### One thing that is not obvious

The Razorpay order is created **outside** the database transaction. Creating
it inside would hold the trip's row lock — which blocks every other booking
for that trip — across an HTTP round trip to a third party. One slow response
would serialise the whole trip behind it.

The cost is a window where a booking exists with no order. That resolves
itself: the hold lapses and the seats come back. A stuck lock would not.

---

## Testing

```bash
node --env-file=.env.local scripts/payment-state.mjs
```

Prints trip capacity, live holds, bookings, payments, refunds, webhook events
and the email log in one screen. Run it before and after a step; the diff is
what the code did.

Razorpay cannot reach `localhost` — their webhook URLs must use port 80 or
443. Use an ngrok tunnel or a preview deploy, and register the URL under
**Test Mode** in their dashboard (test and live webhooks are separate configs).

Test credentials: UPI `success@razorpay` / `failure@razorpay`. Card test
numbers are on Razorpay's docs — note that `4111 1111 1111 1111` is an
**international** card and is rejected unless international payments are
enabled on the account.

### Going live

1. `paymentsConfig.gatewayLive = true` in `lib/data/siteConfig.ts` — restores
   the Razorpay copy across the eight places wired to it
2. `trips.razorpay_enabled = true` per trip — roll out one at a time
3. Swap the test keys for live keys, and register the live webhook separately
