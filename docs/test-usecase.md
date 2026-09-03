# Payment module — the run-through, step by step

The scenarios below were walked by hand on 29 Aug 2026, one at a time, against
the two TEST trips. Every output in here is real — copied from the run, not
written from the code.

Follow it top to bottom. The seat budget on Kotagiri is shared across A1–A7,
so skipping one will throw the numbers off later.

> The companion doc, [test-walkthrough.md](./test-walkthrough.md), explains
> *why* each path exists. This one is the runbook: what to click, what to
> check, and what actually came back.

---

## Before you start

```bash
npm run test:seed                              # create/refresh the two TEST trips
npm run test:reset                             # wipe their bookings, seats back to 0
npm run test:state kotagiri-payment-lab-test   # everything one trip touches
```

Two shell helpers you'll use throughout. **Note the `tr -d '"'`** — the secret
is quoted in `.env.local`, and without stripping it every cron call returns
`{"error":"Not allowed."}`:

```bash
curl -s -H "Authorization: Bearer $(grep -E '^CRON_SECRET=' .env.local | cut -d= -f2- | tr -d '"')" http://localhost:3009/api/cron/release-holds
```

Ageing a hold so you don't wait 15 minutes — **both** timestamps, see A1:

```bash
node --env-file=.env.local -e "import('pg').then(async({default:pg})=>{const c=new pg.Client({connectionString:process.env.DATABASE_URL});await c.connect();await c.query(\"UPDATE seat_holds SET expires_at = now() - interval '1 min' WHERE released_at IS NULL AND booking_id IS NULL\");await c.query(\"UPDATE bookings SET hold_expires_at = now() - interval '1 min' WHERE status='PENDING_PAYMENT'\");console.log('aged');await c.end();})"
```

**Accounts.** A7 needs two, in separate windows — see there for why. Test card
`4111 1111 1111 1111`, any future expiry, any CVV.

**After any migration, restart the dev server.** `prisma generate` alone is not
enough: Next.js caches the imported client for the life of the process, and a
stale one rejects new enum values with nothing more helpful than *"Couldn't
update the booking."*

---

## Track A · Kotagiri — seats and settlement

6 seats · ₹2,000 + 5% GST = **₹2,100** per seat · advance **₹500** · balance ₹1,600

### A1 · A hold, then walk away

**Do:** open the trip → **Book** → 1 traveller → leave **Advance ₹500** →
**Pay** → **close the Razorpay window without paying.**

**Check:** `npm run test:state kotagiri-payment-lab-test`

```
seats_booked=0/6   available=5          ← the whole point
SEAT HOLDS (1)
  5acefd2c  seats=1  expires=14:18:51  LIVE (blocking)
BOOKINGS (1)
  DOT-KO26-0001  PENDING_PAYMENT  paid=₹0/₹2,100  holding→5acefd2c
    └ payment CREATED   ₹500  order_TVWMewbjq9GbZZ  (unpaid)
    └ instal 1. Advance   ₹500  PENDING
    └ instal 2. Balance ₹1,600  PENDING
```

`seats_booked` is **0** while `available` is **5**. Nothing is booked, but the
seat is off the site — held by the `seat_holds` row, not by the counter. That
separation is what makes an abandoned checkout harmless.

Closing the window writes nothing. There is no callback.

**Then:** run the ageing command, then the release cron.

```
{"ok":true,"holdsReleased":1,"bookingsExpired":1}
```

Hold `released_at` set · booking → **EXPIRED** · `seats_booked` still 0 ·
`available` back to **6**.

> **The trap we hit here.** Ageing only `seat_holds.expires_at` gives
> `bookingsExpired: 0`. The deadline is written in **two places** —
> `seat_holds.expires_at` (the seat authority) and `bookings.hold_expires_at`
> (the booking's own copy) — and the cron does two independent jobs, one per
> column. In real life both are written at the same instant so they expire
> together; a hand-written UPDATE has to move both.
>
> `holdsReleased` = seats given back. `bookingsExpired` = abandoned bookings
> marked dead, so `/admin/bookings` doesn't show every abandoned cart as a
> live lead forever.

---

### A2 · Pay the advance

**Do:** Book → 1 traveller → **Advance ₹500** → **pay.** You'll get
`DOT-KO26-0002`.

**Check:**

```
seats_booked=1/6   available=5           ← moves for the first time
SEAT HOLDS
  fbdb4950  seats=1  CONFIRMED→booking   ← A2: consumed
  5acefd2c  seats=1  released            ← A1: returned
DOT-KO26-0002  CONFIRMED  paid=₹500/₹2,100
  └ payment CAPTURED  ₹500  order_TVWeIonhBvMitj  pay_TVWehvaJIW34jY
  └ instal 1. Advance   ₹500  PAID
  └ instal 2. Balance ₹1,600  PENDING
```

Same table, two opposite endings — that's the seat-hold design in two lines.

**Also check the idempotency, which you get for free:**

```
razorpay_events   payment.captured + order.paid   ← 2 rows
audit_log         payment.captured                ← 1 row
email_log         booking_confirmed               ← 1 email
```

Browser callback + two webhook events = **three** calls to `settlePayment()`.
Two hit `claimed.count === 0` and returned `ALREADY_SETTLED` before touching
anything.

---

### A3 · Pay in full, 2 seats

**Do:** Book → **2 travellers** → switch to **Full ₹4,200** → pay.

```
seats_booked 1 → 3
DOT-KO26-0003  CONFIRMED  paid=₹4,200/₹4,200
  └ payment CAPTURED  ₹4,200
                              ← no instalment rows at all
```

The difference is what's **missing**. `if (kind === "ADVANCE")` guards the
schedule — paid in full means there's nothing to schedule.

---

### A4 · Click Pay twice, then change your mind

**Do not pay anything in A4.** Abandon every popup; A6/A7 need the seats.

**Checkpoint 1 — make a hold.** Book → 1 traveller → Advance → Pay → close.

```
DOT-KO26-0004  PENDING_PAYMENT  1 seat
hold 53f10d1d  expires 10:02:35
order_TVXcXlj2bsCkwt  CREATED ₹500
seats_booked 3/6   available 2
```

**Checkpoint 2 — the identical retry.** Wait a minute, then Book → 1 traveller
→ Advance → Pay → close. *Exactly the same as before.*

```
booking     DOT-KO26-0004      unchanged
hold        53f10d1d           unchanged
order       order_TVXcXlj2b…   unchanged
expires_at  10:02:35 → 10:04:16    ← MOVED, +1m41s
row counts  bookings 4 · seat_holds 4 · payments 4    unchanged
```

Nothing created, one thing extended — a fresh 15 minutes from *this* click.
Without it, reopening checkout at minute 14 gives you sixty seconds to find
your card. Without the reuse branch entirely, you'd now hold two seats and be
able to pay for one.

**Checkpoint 3 — change the party size.** Book → **2 travellers** → Pay →
close.

```
DOT-KO26-0004  EXPIRED   pay FAILED  "Superseded by a new order"
               note: "Superseded — traveller count changed from 1 to 2."
DOT-KO26-0005  PENDING_PAYMENT  2 seats  ₹1,000  order_TVXfyE73XOdcUX
hold 53f10d1d  released=true
hold 240aebd2  2 seats, live
seats_booked 3/6   available 1        ← the number that matters
```

**`available` = 1, not 0.** 3 booked + 2 held = 5 of 6. Released and
re-reserved in one transaction, so there is never an instant where both holds
exist — or neither.

---

### A5 · The same payment, twice

Razorpay's dashboard doesn't reliably expose a resend in test mode, so replay
it yourself:

```bash
npm run test:webhook -- DOT-KO26-0002            # stable event id
npm run test:webhook -- DOT-KO26-0002 --fresh    # new event id
```

```
run 1   fresh event id   →  HTTP 200  {"ok":true}
run 2   SAME event id    →  HTTP 200  {"ok":true,"duplicate":true}
run 3   fresh event id   →  HTTP 200  {"ok":true}
```

**After all three:**

```
DOT-KO26-0002  amount_paid_paise = 50000     ← still ₹500
seats_booked   3/6                            ← unchanged
scoped to that booking:  4 events · 1 payment · 1 email · 1 audit
```

**The two runs proved different defences.** Run 2 died at the unique index on
`razorpay_events.event_id` — a real Razorpay retry, caught before any handler.
Runs 1 and 3 wrote an event row and *did* call `settlePayment()`; they were
stopped by the conditional claim:

```sql
UPDATE payments SET status='CAPTURED' WHERE id=? AND status <> 'CAPTURED'   → 0 rows
```

That second one is the load-bearing check. `order.paid` arriving after
`payment.captured` is a genuinely different event for the same money — layer 1
waves it through.

---

### A6 · Sold out

**Do:** Book → **3 travellers** → pay **Full ₹6,300**. `seats_booked` → **6/6**.

Then try to book one more.

> Those seats have just gone. Try a smaller party or another batch.

**Check the rollback** — this is the interesting half:

```
bookings   7      ← 0001–0007. no 0008.
seat_holds 7      ← one per checkout. none from the refusal.
payments   7      ← Razorpay was never called
travellers 11     ← 1+1+2+1+2+1+3, exactly the successful ones
```

`reserve_seats()` raises inside the transaction, so the booking, travellers
and hold already written all roll back together. **The refusal leaves nothing
behind** — no draft, no orphaned hold, no stray order in Razorpay's dashboard,
not even a burned reference number.

---

### A7 · Late Auth — paid, but the seat is gone

Set the trap **before** A6 fills the trip, and use **two accounts in two
windows**.

> **Why two accounts.** The reuse lookup is keyed on `(profileId, tripId)`. If
> the same person holds a `PENDING_PAYMENT` booking and then books again on
> that trip, the code supersedes it — releasing the hold and failing the
> payment, which is exactly what you were about to do by hand, at the wrong
> moment. Two accounts also model the real failure: customer A's bank
> authorising slowly while customer B takes the last seat.

| window | account | job |
|---|---|---|
| A | a fresh customer | sets the trap, popup left open |
| B | your usual test account | fills the trip in A6 |

**1 · Sweep A4's leftovers** — ageing command, then the release cron.
`available` back to 3.

**2 · Window A:** Book → 1 traveller → Advance → **Pay** → **leave the popup
open. Don't pay, don't close.**

```
DOT-KO26-0006  PENDING_PAYMENT  hold 543112d6 live  order_TVXsMjiK0NabTv
```

**3 · Arm it** — age that hold and run the release cron:

```
DOT-KO26-0006  EXPIRED   hold_cleared=true   hold_released=true
               payment CREATED  order_TVXsMjiK0NabTv   ← still payable
seats_booked 3/6   available 3
```

The booking is dead in our database and the seat is back on sale — **and the
popup in Window A has no idea.** That gap *is* Late Auth.

**4 · Window B:** run A6, filling the trip to 6/6.

**5 · Window A: pay the popup that's been sitting there.**

```
DOT-KO26-0006  REQUESTED  paid ₹500/₹2,100  confirmed_at = NULL
               payment CAPTURED  pay_TVXyR5tL9RgUle    ← money is real
seats_booked   6/6                                      ← NO oversell

internal_notes: ⚠ Paid, but the seat hold expired and the trip filled
                before the payment landed. Find a seat or refund.
audit_log:      payment.captured_seat_lost   ← not "payment.captured"
email_log:      booking_seat_unavailable → the customer
                admin_seat_unavailable   → ADMIN_NOTIFICATION_EMAIL
```

`pendingHoldId` is NULL, so settlement falls to the guarded direct claim:

```sql
UPDATE trips SET seats_booked = seats_booked + 1
 WHERE id = ? AND seats_booked + 1 <= total_seats      -- 6+1 <= 6 is false
```

Zero rows. That `WHERE` is the only thing between this and a 7th passenger on
a 6-seat bus.

**On screen** the customer gets a plain sentence, not a status badge — and the
booking page reads **"Payment received"**, not "Request received", because it
checks `amountPaid > 0`. Telling someone who just paid ₹500 that the team will
call to arrange payment would be both wrong and alarming.

**The happier half:** run steps 1–3, **skip step 4**, then pay. With a seat
free the same claim succeeds — `seats_booked` +1, `CONFIRMED`, ordinary
confirmation email. Same code path, opposite outcome, decided entirely by
whether the seat was there.

---

## Track B · Ooty — money over time

10 seats · ₹5,000 + 5% GST = **₹5,250** per seat · advance **₹2,000** ·
balance ₹3,250 · **departs in 3 days**

### B1 · Advance paid, balance owed

**Do:** Book → 1 traveller → **Advance ₹2,000** → pay.

```
DOT-OO26-0001  CONFIRMED  paid=₹2,000/₹5,250
  └ payment CAPTURED  ₹2,000  order_TVY50Nd37w8Mst  pay_TVY54fgu7qdQA8
  └ instal 1. Advance  ₹2,000  PAID
  └ instal 2. Balance  ₹3,250  PENDING   due 2026-08-31
seats_booked 1/10
```

Mechanically identical to A2 — nothing special happens at checkout. **That
`PENDING` instalment is the point:** it's a debt the system now has to chase on
its own, and everything in Track B follows from it.

---

### B2 · The reminder cron

The trip departs in 3 days, which is inside the daily window.

```bash
curl -s -H "Authorization: Bearer $(grep -E '^CRON_SECRET=' .env.local | cut -d= -f2- | tr -d '"')" http://localhost:3009/api/cron/balance-reminders
```

```json
{"ok":true,
 "schedule":{"dueDay":15,"oneOff":[],"dailyFinalDays":5,"offsets":[15,5,4,3,2,1]},
 "considered":1,"sent":1,"skipped":0}
```

Subject that lands: **"3 days to Ooty Balance Lab (TEST) — ₹3,250
outstanding"**. The day count is computed from the real departure date, so it
reads correctly at any offset.

**Now run the exact same command again.** This is the half that matters:

```json
{"considered":1,"sent":0,"skipped":1,"skippedBecause":{"already-sent":1}}
```

Found again, sent nothing. **Idempotency here is the dedupe key, not the
schedule** — `balance_reminder:<booking>:<offset>`. Nothing enforces
"once a day" except that unique index, which is why re-running the job is safe
and is the normal way to check it works.

**How the cron decides**, in one sentence: *how many days until this trip
leaves — is that number in the list?* The list is `[15, 5, 4, 3, 2, 1]`, from
`site_settings.balance_reminder`.

```
29 Aug   3 days away   3 is in the list   → SEND
30 Aug   2 days away   2 is in the list   → SEND
31 Aug   1 day away    1 is in the list   → SEND
 1 Sept  0 days away   0 is NOT            → nothing (they're travelling)
```

**Other offsets** — move the departure and re-run; nothing else changes:

```bash
node --env-file=.env.local -e "import('pg').then(async({default:pg})=>{const c=new pg.Client({connectionString:process.env.DATABASE_URL});await c.connect();await c.query(\"UPDATE trips SET start_date = CURRENT_DATE + 15, end_date = CURRENT_DATE + 16 WHERE slug='ooty-balance-lab-test'\");console.log('moved');await c.end();})"
```

`15` is the due-date nudge · `1`–`5` the daily push · `7` should send nothing
(`not-a-reminder-day`). `npm run test:seed` puts the date back.

Once the balance is paid, the same call returns
`"skippedBecause":{"no-balance":1}` — settled bookings are not chased.

---

## Where to look

```bash
npm run test:state kotagiri-payment-lab-test
```

Trip counters, the last six holds with their live/lapsed/consumed state,
bookings with payments, instalments and refunds, recent webhook events, and
the email log — one screen. Run it before a step and after; the diff is what
the code did.

| | |
|---|---|
| Razorpay orders | dashboard → **Transactions → Orders**, receipt = booking reference |
| Webhook config | dashboard → **Account & Settings → Webhooks** |
| Emails | `email_log` table, or the Resend dashboard |
| Tunnel | `curl -s localhost:4040/api/tunnels` |

Webhooks need the public ngrok URL — Razorpay only delivers to ports 80/443,
so localhost cannot receive them directly.

---

## What test mode can't show you

- **Late Auth is staged, not real.** A7 forces the state by hand; genuine late
  authorisation is a bank-side delay you cannot induce.
- **The gateway fee doesn't appear.** With "Customer pays the fee" on, the
  captured amount exceeds the order and the difference lands in
  `payments.convenience_fee_paise`. Test payments capture the exact order
  amount, so that column stays 0 here.
- **Refund arrival.** Razorpay tells you when a refund was *sent*
  (`refund.processed`); nothing tells anyone when it *lands*. That is why the
  customer email and the booking page both say 5–7 working days and invite a
  reply.
