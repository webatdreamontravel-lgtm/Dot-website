# Walking the payment module by hand

Two trips exist purely so every branch in the payment code can be reached on
purpose, one at a time, and checked against the database and the Razorpay
dashboard.

```bash
npm run test:seed     # create or refresh the two test trips
npm run test:reset    # wipe their bookings, payments and holds; seats back to 0
npm run test:state kotagiri-payment-lab-test    # everything one trip touches
```

`test:reset` is scoped to a hardcoded allowlist of two slugs and refuses to
run against a trip whose title isn't marked `(TEST)`. It cannot touch Walayar,
Thekkady or Wayanad.

---

## The two trips

| | **Kotagiri Payment Lab** | **Ooty Balance Lab** |
|---|---|---|
| slug | `kotagiri-payment-lab-test` | `ooty-balance-lab-test` |
| references | `DOT-KO26-0001…` | `DOT-OO26-0001…` |
| seats | **6** | 10 |
| departs | ~105 days out | **3 days out** |
| per seat | ₹2,000 + 5% GST = **₹2,100** | ₹5,000 + 5% GST = **₹5,250** |
| advance | **₹500** (balance ₹1,600) | **₹2,000** (balance ₹3,250) |
| tests | holds, settlement, sold-out, late auth | balances, reminders, crons |

Six seats on Kotagiri is deliberate: it is small enough that sold-out and
late-authorisation are reachable in four bookings instead of twenty. Its
December departure keeps it outside every reminder offset, so the nightly
cron never touches it and the seat arithmetic stays clean.

Ooty departing in three days is equally deliberate: that is inside the daily
reminder window, so the reminder cron has something to find the first time
you run it.

**The two tracks are independent** — different trips, no shared seat budget.
Run them in parallel.

### The money, precomputed

| Kotagiri | 1 seat | 2 seats | 3 seats |
|---|---|---|---|
| subtotal | ₹2,000 | ₹4,000 | ₹6,000 |
| GST 5% | ₹100 | ₹200 | ₹300 |
| **total** | **₹2,100** | **₹4,200** | **₹6,300** |
| advance | ₹500 | ₹1,000 | ₹1,500 |
| balance | ₹1,600 | ₹3,200 | ₹4,800 |

| Ooty | 1 seat | 2 seats |
|---|---|---|
| **total** | **₹5,250** | **₹10,500** |
| advance | ₹2,000 | ₹4,000 |
| balance | ₹3,250 | ₹6,500 |

---

## The mental model

Three ideas explain nearly every row you are about to see.

**1. A held seat and a booked seat are counted in different places.**

`trips.seats_booked` counts seats that are *paid for or promised*. Seats that
someone is merely in the middle of buying live in `seat_holds` instead. What
the public site shows is the difference:

```
available = total_seats − seats_booked − (live, unreleased holds)
```

So during checkout, `seats_booked` does **not** move and availability drops
anyway. That is why an abandoned checkout never permanently burns a seat: the
hold expires and availability comes straight back, without anything ever
having been added to or subtracted from `seats_booked`.

**2. Money is only ever settled in one function.**

The browser callback (`/api/payments/verify`) and the webhook
(`/api/webhooks/razorpay`) both call `settlePayment()`. Neither is trusted to
be the only one that runs — the customer can close the tab the instant they
pay, and Razorpay retries a failed delivery for 24 hours. Whichever arrives
first does the work; the second finds it done.

**3. Every amount on a booking is a snapshot.**

`unit_price_paise`, `gst_percent`, `total_paise` are copied onto the booking
at creation and never re-read from the trip. Reprice the trip tomorrow and
this booking still owes what was agreed. Everything is integer paise.

---

## Track A — Kotagiri: seats and settlement

Run these in order; the seat budget is shared across them.

### A1 · A hold, then walk away

**Do:** `/trips/kotagiri-payment-lab-test/book`, 1 traveller, click Pay — then
**close the Razorpay window without paying**.

**Written the moment you click Pay** (before Razorpay is even contacted):

| table | rows | what |
|---|---|---|
| `seat_holds` | +1 | `seats=1`, `expires_at = now()+15min`, `booking_id NULL`, `released_at NULL` |
| `bookings` | +1 | `DOT-KO26-0001`, **`PENDING_PAYMENT`**, `total_paise=210000`, `amount_paid_paise=0`, `pending_hold_id` → the hold |
| `booking_travellers` | +1 | the traveller |
| `booking_instalments` | +2 | `1 Advance ₹500` / `2 Balance ₹1,600`, both `PENDING` |
| `payments` | +1 | `RAZORPAY`, **`CREATED`**, `amount_paise=50000`, `razorpay_order_id=order_…`, no payment id |
| `trips.seats_booked` | — | **unchanged, still 0** |

`npm run test:state kotagiri-payment-lab-test` should show
`seats_booked=0/6 available=5`. The seat is gone from the site but nothing has
been booked. **Closing the window writes nothing** — there is no callback.

**Then, after 15 minutes:**

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3009/api/cron/release-holds
```

```
{"ok":true,"holdsReleased":1,"bookingsExpired":1}
```

- `seat_holds.released_at` = now()
- `bookings.status` → **`EXPIRED`**, `pending_hold_id` → NULL
- `seats_booked` still 0 — nothing to give back, it was never taken
- `available` back to **6**

Don't want to wait 15 minutes? Expire it by hand:

```bash
psql "$DIRECT_URL" -c "UPDATE seat_holds SET expires_at = now() - interval '1 min' WHERE released_at IS NULL AND booking_id IS NULL"
```

---

### A2 · Pay the advance

**Do:** book 1 seat, choose **Advance ₹500**, pay with Razorpay's test card
`4111 1111 1111 1111`, any future expiry, any CVV.

Same rows as A1 appear first. Then `settlePayment()` runs — from the browser
callback, the webhook, or both:

| table | change |
|---|---|
| `payments` | `CREATED` → **`CAPTURED`**, `razorpay_payment_id` set, `signature_verified=true`, `captured_at` |
| `trips` | `seats_booked` **0 → 1** (via `confirm_seat_hold`) |
| `seat_holds` | `booking_id` set — the hold is consumed, not released |
| `bookings` | `amount_paid_paise` 0 → **50000**, status → **`CONFIRMED`**, `confirmed_at` set, `pending_hold_id`/`hold_expires_at` → NULL |
| `booking_instalments` | seq 1 `PENDING` → **`PAID`** |
| `payments.instalment_id` | → the advance instalment |
| `audit_logs` | +1 `payment.captured` |
| `email_log` | +1 `booking_confirmed` |
| `razorpay_events` | +2 — `payment.captured` and `order.paid` |

**Check:** paid ₹500 of ₹2,100, balance ₹1,600, `seats_booked=1/6`.

The booking page at `/account/bookings/DOT-KO26-0001` now shows a **Pay ₹1,600
balance** button. That is Track B's subject — leave it for now.

---

### A3 · Pay in full, 2 seats

**Do:** book **2 travellers**, choose **Full ₹4,200**, pay.

The one difference worth watching: **no `booking_instalments` rows are
written.** A schedule with a single already-paid entry is noise. `kind=FULL`
skips it entirely.

| | |
|---|---|
| `payments` | one row, `amount_paise=420000`, `CAPTURED` |
| `trips.seats_booked` | **1 → 3** |
| `bookings` | `amount_paid_paise = 420000 = total_paise`, `CONFIRMED`, balance ₹0 |

The account page shows no balance button — there is nothing to pay.

---

### A4 · Click Pay twice, then change your mind

Two different behaviours that look the same from the outside.

**(a) Identical retry — reuse.** Start a checkout for 1 seat, close the
window, go back and start it again with **the same seat count and the same pay
mode**.

- **No new booking, no new hold, no new order.** You get `DOT-KO26-0004` back
  and the *same* `razorpay_order_id`.
- `seat_holds.expires_at` is **pushed out to a fresh 15 minutes** — and only
  ever extended, never shortened. Without this, someone who reopens checkout at
  minute 14 of their own hold gets sixty seconds to find their card, and the
  failure looks like our bug.

**(b) Something changed — supersede.** Now go back and change it to **2
seats** (or switch Advance → Full).

All in one transaction, so there is never a moment where three seats are held:

| table | change |
|---|---|
| old `seat_holds` | `released_at` = now() |
| old `bookings` | → **`EXPIRED`**, note: *"Superseded — traveller count changed from 1 to 2."* |
| old `payments` | → **`FAILED`**, `failure_reason: "Superseded by a new order"` |
| new rows | a fresh hold, booking and order for 2 seats |

**Check:** `available` drops by exactly 2, not 3. Abandon this one — the seat
budget for A6 depends on it.

---

### A5 · The same payment, twice

Two separate defences, and it's worth seeing both.

**(a) The identical delivery.** Razorpay retries for 24 hours; a retry is
byte-identical, same `x-razorpay-event-id`.

Replay A2's webhook from the Razorpay dashboard → **Webhooks → the delivery →
Resend**.

```json
{"ok":true,"duplicate":true}
```

Nothing else is written. The unique index on `razorpay_events.event_id` caught
it before any handler ran. Note it returns **200, not an error** — a 500 here
would earn 24 hours of retries for something already handled.

**(b) A genuinely new event for a payment already settled.** `order.paid`
arriving after `payment.captured` looks like this. A new `razorpay_events` row
*is* written, the handler *does* run, and then:

```sql
UPDATE payments SET status = 'CAPTURED' WHERE id = ? AND status <> 'CAPTURED'
```

matches **zero rows**. `settlePayment` returns `ALREADY_SETTLED` and stops.
`amount_paid_paise` is not credited twice, no second confirmation email is
sent.

**Check:** `SELECT amount_paid_paise FROM bookings WHERE reference='DOT-KO26-0002'`
is still ₹500 after every replay.

---

### A6 · Sold out

You should be at **3 of 6**.

**Do:** book **3 seats** and pay in full (₹6,300). `seats_booked` → **6/6**.

Now try to book **one more seat**.

`reserve_seats()` raises `INSUFFICIENT_SEATS` inside the transaction, so the
booking, the hold and the traveller rows all roll back together — **nothing is
written**. The form says:

> Those seats have just gone. Try a smaller party or another batch.

**The more interesting version:** reset, get the trip to 3/6, then have one
browser hold 3 seats *without paying* while a second tries to book 1. The
second is refused even though `seats_booked` is only 3 — because
`trip_seats_available()` subtracts live holds. That is the oversell guard
doing its actual job.

---

### A7 · Paid, but the seat is gone (Late Auth)

The nastiest real case: the customer pays, the bank authorises minutes later,
and by then the hold has lapsed and the trip has filled. Razorpay calls it
Late Auth. Money arrives with no seat behind it.

**Staging it** — do this *before* A6 fills the trip:

1. At 3/6, start a checkout for 1 seat. **Do not pay.** Leave the Razorpay
   window open.
2. Expire the hold and sweep it:
   ```bash
   psql "$DIRECT_URL" -c "UPDATE seat_holds SET expires_at = now() - interval '1 min' WHERE released_at IS NULL AND booking_id IS NULL"
   curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3009/api/cron/release-holds
   ```
   The booking is now `EXPIRED` with `pending_hold_id = NULL`.
3. Run A6 to fill the trip to 6/6.
4. **Now pay** in the window you left open.

**What happens:** `pending_hold_id` is NULL, so there is no hold to confirm.
The code falls through to a direct, guarded claim:

```sql
UPDATE trips SET seats_booked = seats_booked + 1
 WHERE id = ? AND seats_booked + 1 <= total_seats
```

The `WHERE` clause is the whole guard — it can only ever take a seat the trip
genuinely has, so two late payments racing for one remaining seat cannot both
win. Here it matches **zero rows**.

| table | change |
|---|---|
| `payments` | `CAPTURED` — the money is real |
| `trips.seats_booked` | **unchanged at 6/6** — no oversell |
| `bookings` | `amount_paid_paise` credited, status → **`REQUESTED`**, note: *"⚠ Paid, but the seat hold expired and the trip filled…"* |
| `audit_logs` | `payment.captured_seat_lost` |
| `email_log` | +2 — one to the customer, one to `ADMIN_NOTIFICATION_EMAIL` |

**What the customer sees** at `/account/bookings/…` — not the standard
"Request received" copy, which would tell someone who just paid ₹2,100 that we
will call to arrange payment:

> **Payment received** — We have your payment, but the last seat was taken
> moments before it reached us. That's on us — one of us will call you within
> one working day with a seat on the next departure or a full refund.

**The happier half of the same test:** run steps 1–2, **skip step 3**, then
pay. With a seat free the direct claim succeeds: `seats_booked` +1, status
`CONFIRMED`, ordinary confirmation email. Same code path, different outcome,
decided entirely by whether the seat was there.

---

## Track B — Ooty: money over time

### B1 · Advance paid, balance owed

**Do:** book 1 seat on `/trips/ooty-balance-lab-test/book`, choose **Advance
₹2,000**, pay.

Identical mechanics to A2. Ends at `amount_paid_paise = 200000`,
`total_paise = 525000`, **balance ₹3,250**, `booking_instalments` seq 1 `PAID`
and seq 2 `PENDING`.

---

### B2 · Pay the balance

**Do:** `/account` → the card shows **Pay ₹3,250** without opening the booking.
Click it and pay.

This does **not** go through `createPaymentOrder`. There are no seats to hold
and no booking to create — both already exist:

| table | change |
|---|---|
| `payments` | **+1 new row**, `amount_paise=325000`, new `razorpay_order_id`. Payments are append-only; the advance row is never modified |
| `bookings` | `amount_paid_paise` 200000 → **525000**, status stays `CONFIRMED` |
| `booking_instalments` | seq 2 → **`PAID`** |
| `trips.seats_booked` | **unchanged** ← the thing to check |

> **That last row is a bug that was live until this session.** Settlement
> treated "no pending hold" as proof this was a first payment needing a seat,
> which is true for Late Auth and false for every balance. Paying a balance
> claimed a *second* seat for the same traveller — one booking, two seats. On
> a nearly-full trip it was worse: the claim failed, and a **fully paid**
> booking was flipped to `REQUESTED` with "⚠ Paid, but the seat hold expired"
> and the customer emailed to say we couldn't seat them.
>
> Fixed by consulting the booking's status: `CONFIRMED` and `REQUESTED`
> already own their seats, so there is nothing to claim. Both Late Auth paths
> were re-tested and are unchanged.

**Check:** `seats_booked` is the same before and after, and the balance button
disappears.

---

### B3 · The reminder cron

Ooty departs in 3 days, which is inside the daily window.

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3009/api/cron/balance-reminders
```

With B1 done but not B2:

```json
{"ok":true,
 "schedule":{"oneOff":[21,14],"dailyFinalDays":5,"offsets":[21,14,5,4,3,2,1]},
 "considered":1,"sent":1,"skipped":0}
```

`email_log` gains one row, subject:

> **3 days to Ooty Balance Lab (TEST) — ₹3,250 outstanding**

The subject counts real days, so it reads correctly at any offset.

**Run it again.** This is the important half:

```json
{"considered":1,"sent":0,"skipped":1,"skippedBecause":{"already-sent":1}}
```

Idempotency here is the `dedupeKey` — `balance_reminder:<booking>:<offset>` —
not the schedule. A cron that double-fires and chases someone twice for the
same money is worse than one that misses a day.

*(Until this session that re-run reported `sent: 1`, because a suppressed
duplicate was indistinguishable from a send. The count now tells the truth,
which matters when re-running the job is how you check it works.)*

**Once B2 is paid**, the same call returns
`"skippedBecause":{"no-balance":1}` — settled bookings are not chased.

**Other offsets.** Move the departure and re-run; the trip is the only thing
that changes:

```bash
psql "$DIRECT_URL" -c "UPDATE trips SET start_date = CURRENT_DATE + 14, end_date = CURRENT_DATE + 15 WHERE slug='ooty-balance-lab-test'"
```

`14` and `21` are the one-off nudges; `1`–`5` are the daily window; `7` should
send nothing (`not-a-reminder-day`). `npm run test:seed` puts the date back.

The schedule itself lives in `site_settings` under `balance_reminder`, so it
changes without a deploy:

```bash
psql "$DIRECT_URL" -c "UPDATE site_settings SET value = '{\"enabled\":true,\"daysBefore\":[21,14,7],\"dailyFinalDays\":3,\"minBalancePaise\":0}' WHERE key='balance_reminder'"
```

---

### B4 · Nudge someone by hand

**Do:** `/admin/bookings/DOT-OO26-0001` → **Balance reminder** → *Send
reminder now*.

Same template as the cron — one template, so a manual nudge can never drift
from the automated one. Different dedupe namespace
(`balance_reminder:manual:<booking>:<date>`), which means a person can still
nudge today even if this morning's automated one already went, while a
double-click sends once.

Click it twice: the second says **"Already sent today — nothing sent again."**
and writes nothing.

---

### B5 · A booking taken over the phone

**Do:** `/admin/bookings/new` → pick Ooty → search for the customer or enter a
new one → 1 seat → source **ADMIN_OFFLINE** → payment **₹5,250 CASH**.

Worth doing because it proves the offline path lands a booking in *exactly* the
same shape as the online one:

- It runs the **same** `reserve_seats()` / `confirm_seat_hold()` pair, so an
  admin at a stall cannot oversell against someone booking online at that
  moment.
- `payments` gets `method=CASH`, `status=CAPTURED`, `recorded_by_profile_id`
  set, and **no** `razorpay_order_id`.
- `bookings` → `CONFIRMED` with `amount_paid_paise` set, identical to A2.
- A new customer gets a Supabase auth user with no password. That is what
  makes it claimable later: when the real person signs up with that address,
  this booking is already waiting for them.

Record **₹2,000** instead of the full amount and the booking carries a ₹3,250
balance — which B3's cron will then chase, exactly as it would for a web
booking.

---

## Where to look

```bash
npm run test:state kotagiri-payment-lab-test
```

Trip counters, the last six holds with their live/lapsed/consumed state,
bookings with their payments, instalments and refunds, recent webhook events,
and the email log — one screen. Run it before a step and after; the diff is
what the code did.

| | |
|---|---|
| Razorpay orders | dashboard → **Transactions → Orders**, receipt = booking reference |
| Webhook deliveries | dashboard → **Settings → Webhooks**, with Resend |
| Emails | `email_log` table, or the Resend dashboard |
| Tunnel | `curl -s localhost:4040/api/tunnels` |

Webhooks need the public URL — Razorpay will not deliver to a port other than
80 or 443, so localhost cannot receive them directly:

```
https://<your-ngrok-host>/api/webhooks/razorpay
```

Test cards: `4111 1111 1111 1111` succeeds, `5104 0600 0000 0008` fails. Any
future expiry, any CVV.

---

## Test-card limits

Two things the test keys cannot show you, both worth knowing before launch:

- **Late Auth is staged, not real.** A7 forces the state by hand. Genuine late
  authorisation is a bank-side delay you cannot induce in test mode.
- **The gateway fee doesn't appear.** With "Customer pays the fee" enabled,
  the captured amount exceeds the order and the difference is recorded in
  `payments.convenience_fee_paise`. Test payments capture the exact order
  amount, so that column stays 0 here. Settlement tolerates the difference —
  more than the order is expected, less is refused — but the first real
  payment is where you will see a non-zero fee.
