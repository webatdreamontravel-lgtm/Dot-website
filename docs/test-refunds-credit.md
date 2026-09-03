# Refunds, carried-forward credit and statuses — the run-through

Everything money can do to a booking after it has been paid for. Follow it
top to bottom on **Coonoor Test Bench** — the seat budget and credit balance
carry between scenarios, so skipping one throws the later numbers off.

The earlier document, [test-usecase.md](./test-usecase.md), covers getting
money *in*: holds, advances, sold-out, Late Auth, reminders. This one starts
where that one ends.

---

## Before you start

```bash
npm run test:seed                             # three TEST trips
npm run test:state coonoor-test-bench-test    # everything one trip touches
```

**Coonoor** — 20 seats · **₹4,000 + 5% GST = ₹4,200** a seat · advance
**₹1,500** · balance ₹2,700 · departs in ~60 days, so no reminder cron
interferes. References `DOT-CO26-…`.

Twenty seats is the point: nothing here should run out, and you can repeat any
scenario without re-seeding.

**Restart the dev server after any migration.** `prisma generate` alone leaves
the running process with a stale client, and the error it gives —
`Unknown argument 'method'` — says nothing about why. This caught us three
times in one day.

### The four numbers everything is measured from

```
paid       amount_paid_paise      what they handed over. History; never decreases.
refunded   refunded_paise         SUM of PROCESSED refunds. Recomputed, never incremented.
credit     SUM(ISSUED on this booking)   money that left for the customer's ledger
─────────────────────────────────────────────────────────────────────────────
HELD       paid − refunded − credit      what the booking still has of theirs
```

And **two separate refund ceilings**, which is the thing most worth
understanding before you start:

```
Razorpay can send   min( what the gateway received − what went back THROUGH it , HELD )
By hand you can     HELD
```

Handing over cash takes nothing out of Razorpay. That is why the two move
independently, and C7 is the scenario that proves it.

---

## Part 1 · Money in, and the caps on it

### C1 · Advance, then balance

**Do:** book 1 seat as **Ajay T1**, pay the **₹1,500 advance** online.
Then open the booking in admin and record **₹2,700 cash**.

```
after the advance   paid ₹1,500   HELD ₹1,500   Balance ₹2,700
after the cash      paid ₹4,200   HELD ₹4,200   Balance ₹0
```

**Then try to record ₹100 more.** The Record-a-payment panel should have
replaced itself with:

> This booking is paid in full — there's nothing left to record.

No fields, no button. A disabled button beside empty boxes still invites an
amount.

### C2 · The cap while a balance exists

**Do:** book another seat, pay the ₹1,500 advance, then try to record
**₹5,000** cash against a ₹2,700 balance.

The "Fill the full balance" link is replaced by **"More than the ₹2,700
outstanding"** and the button greys out. Submit is blocked before the server
is called — the server refuses too, but by then seats have been held and
released for nothing.

### C3 · Credit as a payment method

Santhosh T3 is holding **₹3,100** of travel credit.

**Do:** `/admin/bookings/new` → search *Santhosh*. Before you even pick him,
the search row should carry a green **₹3,100 travel credit** chip.

Pick him, 1 seat, and in **4 · Money taken now** the box above the fields
reads:

```
Santhosh T3 has ₹3,100 of travel credit.              Use it
Choose Travel credit as the method to put it towards this booking.
```

Click **Use it** — method and amount fill in one go. Save.

```
payments        ₹3,100  CREDIT
credit_entries  −₹3,100  REDEEMED  →  DOT-CO26-000n
Santhosh's balance   ₹3,100 → ₹0
Balance on the booking  ₹1,100 still owed
```

**The point:** credit is a *payment method*, not a parallel money system. The
booking's paid total, balance, reminders and every report handle it with no
special cases.

### C4 · Overspending credit

**Do:** on a fresh booking for Santhosh (balance now ₹0 after C3), or type
more than he has: enter **₹9,000** against a ₹3,100 balance.

Three guards, each independent:

```
1  the form          "That's more than they have. The most you can apply is ₹3,100."
2  redeemCredit()    row-locks the profile, re-reads, refuses
3  a Postgres trigger  refuses any insert that would take the balance negative
```

Guard 3 is worth knowing about: it holds even if every line of application
code is wrong.

---

## Part 2 · Refunds

### C5 · A Razorpay refund

**Do:** on the C1 booking (paid ₹4,200 — ₹1,500 online, ₹2,700 cash), open
the **Refund** panel.

```
Already refunded              ₹0
Paid through Razorpay     ₹1,500
Can refund (max)          ₹1,500     ← NOT ₹4,200
```

**That ceiling is the scenario.** Razorpay cannot send back the ₹2,700 it
never received. Refund **₹500**.

The row is written `PENDING` — Razorpay confirms asynchronously. Nothing
changes on the booking yet: `refunded_paise` stays ₹0, because that column
means *"left our account"*, not *"we asked"*.

When the webhook lands (seconds, in test mode):

```
refunds         PENDING → PROCESSED, processed_at set
bookings        refunded_paise ₹0 → ₹500
HELD            ₹4,200 → ₹3,700
email → customer   "₹500 refunded… 5 to 7 working days"
```

### C6 · A refund by hand, in cash

**Do:** same booking, the **Returned by hand** panel below.

```
Still held on this booking            ₹3,700
AMOUNT [ 1000 ]     HOW YOU RETURNED IT [ Cash ]
```

Record it. Unlike C5 this is **PROCESSED immediately** — the money is already
in their hand by the time you type it, so a pending state would describe
something that had finished.

```
refunds         +1 row, CASH, PROCESSED, razorpay_refund_id NULL
bookings        refunded_paise ₹500 → ₹1,500
HELD            ₹3,700 → ₹2,700
email → customer  "we've returned ₹1,000 to you in cash"   ← NO bank wait
```

**Check that email.** It must not say *"5 to 7 working days"* about cash the
customer is holding. The template varies its timing by method: cash gets
none, UPI says *"should be with you already"*, bank transfer says *"within a
working day"*.

**The panel should stay open** with the fields cleared, ready for the next
one. Returning money in pieces is the whole job of that screen.

### C7 · The two ceilings, moving independently

This is the one worth doing carefully — it is where a real bug was found.

After C5 and C6:

```
paid ₹4,200 · through Razorpay ₹1,500
refunded ₹1,500 · through Razorpay ₹500
HELD ₹2,700
```

**Check both panels:**

```
Refund (Razorpay)     Can refund (max)   ₹1,000   = ₹1,500 − ₹500
Returned by hand      Still held         ₹2,700
```

**The Razorpay ceiling must NOT be ₹0.** Before the fix it subtracted the
₹1,000 cash refund from the gateway's ceiling — but handing over cash takes
nothing out of Razorpay, which is still holding ₹1,000 of the ₹1,500 it
received.

Now refund **₹1,000 by UPI** in the hand panel and re-check:

```
Refund (Razorpay)     still ₹1,000   ← unchanged; UPI is not Razorpay
Returned by hand      ₹2,700 → ₹1,700
```

### C8 · Both limits at once

**Do:** try **₹1,500** in the Razorpay panel.

Refused: only ₹1,000 is left with the gateway. The panel already says so.

Then refund the **₹1,000** through Razorpay so `HELD` falls to ₹700, and
check the Razorpay panel again:

```
Can refund (max)   ₹0    ← the gateway is empty
Still held         ₹700  ← but ₹700 is still returnable BY HAND
```

**The smaller of the two limits always wins**, and which one binds changes as
you go. `min(gateway − gateway refunds, held)`.

### C9 · A failed refund

Only reachable by replay — Razorpay's test mode will not fake a bank
rejection.

```bash
npm run test:webhook -- DOT-CO26-0001 --event=refund.failed
```

```
refunds      new row, FAILED, failure_reason set, processed_at NULL
bookings     refunded_paise UNCHANGED — the money never left
email → ADMIN_NOTIFICATION_EMAIL   "⚠ Refund failed"
email → customer   NOTHING
```

**The customer is deliberately not told.** They were never promised this
refund had gone — the "on its way" email only fires on `refund.processed`. A
technical failure they can do nothing about would only alarm them.

Check the **Refunds** panel on the booking: the FAILED row is listed with its
reason. It used to be invisible everywhere, so you could not tell a refund
that was tried and rejected from one never raised.

### C10 · What the customer sees

Open `/account/bookings/DOT-CO26-…` as the customer.

```
HOW YOU PAID
Paid online   30 Aug     ₹1,500
Cash          30 Aug     ₹2,700
You paid                 ₹4,200

HOW IT WAS REFUNDED
Back to the account you paid from   − ₹1,500
In cash                             − ₹1,000
By UPI                              − ₹1,000
Refunded in total                   − ₹3,500
```

Three things to check:

- **Refunds are grouped by method**, not one row per refund. Two card refunds
  a minute apart are one fact to a customer.
- **The green banner names only the gateway portion.** Telling someone to
  wait a week for money already in their pocket is what generates a call.
- **PENDING refunds are absent.** Money that has not left cannot be looked
  for, and including it would stop the lines summing to the total.

---

## Part 3 · Statuses and seats

Watch `seats_booked` on every one of these:

```bash
npm run test:state coonoor-test-bench-test
```

### C11 · Confirmed → Cancelled

**Do:** set a confirmed booking to **Cancelled** with a reason.

The confirm step names the recipient before it sends:

> Change status to **Cancelled** and email santhosh@… a cancellation notice?

```
trips.seats_booked   −1        ← seat back on sale
bookings             CANCELLED, cancelled_at, cancellation_reason
email → customer     "your booking has been cancelled"
```

**Read that email.** It says what was paid and that someone will be in touch
about it — and deliberately quotes **no refund percentage**, because the
policy page and the actual practice do not currently agree.

### C12 · Cancelled → Confirmed, on a full trip

**Do:** cancel a booking on **Kotagiri** (1 seat free, 5 of 6 taken), fill
the trip, then try to un-cancel.

```
Seats will be taken from the trip — this fails if it's now full.
```

It fails. `assertCapacity` runs inside the transaction, so the status change
rolls back rather than overselling.

### C13 · Carried forward, with a cancellation charge

**Do:** on a booking where Santhosh paid ₹4,200, set status to **Carried
forward**.

The panel appears inline with **both boxes typable**:

```
Santhosh T3 has held                         ₹4,200
TRAVEL CREDIT (₹)         CANCELLATION CHARGE (₹)
[ 3700 ]                  [ 500 ]
The two add up to ₹4,200. Type either one.
```

Type `500` into the charge and the credit becomes `3700`. Type `3700` into
the credit and the charge becomes `500`. **Only the credit is state**; the
charge is derived and writes back through the same subtraction, so the two
can never disagree.

```
trips.seats_booked   −1                    ← seat released, same as cancelling
bookings             CARRIED_FORWARD, cancelled_at set
                     amount_paid_paise UNCHANGED — nothing was refunded
credit_entries       +₹3,700 ISSUED  →  from this booking
email → customer     "₹3,700 is waiting for your next trip"
HELD                 ₹4,200 → ₹500          ← the money left for the ledger
4th stat card        "Carried forward ₹3,700 · to travel credit"
```

**No money moves and Razorpay is never told.** `refunded_paise` stays ₹0
because you did not refund anything.

### C14 · Carrying forward more than you hold

**Do:** on a booking holding ₹2,700, type **₹3,000** of credit.

The charge box clamps to `0` and an amber line appears:

```
Goodwill added — above what we hold          ₹300
```

The confirm step then says *"That is ₹300 more than Santhosh T3 has with
us"*. Allowed — a goodwill top-up on a trip DOT cancelled is real — but only
with the second click.

### C15 · Spending the credit

**Do:** `/admin/bookings/new`, pick Santhosh, apply part of his new balance.

Then **`/admin/customers/<id>?tab=credit`**:

```
AVAILABLE NOW   CREDITED IN TOTAL   USED
₹1,700          ₹3,700              ₹2,000

Date          What happened   Booking          Amount    Balance after
30 Aug        Used            DOT-CO26-0007   −₹2,000       ₹1,700
30 Aug        Credited        DOT-CO26-0004   +₹3,700       ₹3,700
```

The header balance is a plain `SUM` of the same rows, so it and the last
running figure are the same arithmetic done in two directions — **they cannot
disagree.** There is no balances table.

### C16 · The closed-booking figures

Check the fourth stat card across statuses. It answers a different question
depending on where the booking is:

| booking | card |
|---|---|
| live, owes money | **Balance** ₹2,700 |
| live, overpaid | **To refund** ₹200 |
| carried forward | **Carried forward** ₹3,700 |
| closed, money kept | **Retained** ₹500 · kept from this booking |
| closed, nothing kept | **Settled** ₹0 · nothing owed either way |

"Balance ₹0" on a cancelled booking was true and useless. **Retained** is the
cancellation charge by another name, and it is the figure worth reading.

---

## Part 4 · The awkward ones

### C17 · One traveller drops out

**Do:** book **3 seats**, pay in full (₹12,600). Then **Cancel this seat** on
traveller 3.

```
trips.seats_booked   −1
bookings             seats 3 → 2, total_paise ₹12,600 → ₹8,400
                     amount_paid_paise UNCHANGED at ₹12,600
```

The booking is now legitimately **paid past its own total** — the price moved,
the money already handed over did not.

**Admin:** the fourth card flips to **"To refund ₹4,200 · held above the trip
total"**, and the refund panel warns that refunding its full ceiling would
leave the booking underpaid.

**Customer:** the cancelled traveller stays in the list, struck through with
a `CANCELLED` chip. Silently dropping them is what makes the repricing look
like a billing error.

### C18 · Refund, then carry forward the rest

**Do:** on that booking — refund **₹2,000** through Razorpay, then carry the
booking forward.

The carry-forward panel must offer **₹10,600**, not ₹12,600:

```
Santhosh T3 has held             ₹10,600
      ₹12,600 paid · ₹2,000 already refunded
```

Offering ₹12,600 would invent ₹2,000 you no longer have. Both the panel and
the server measure the "more than they have" warning against **held**.

### C19 · Everything at once

The full-house check. One booking that has been:

```
paid by credit + online + cash
refunded partly through Razorpay
refunded partly in cash
one traveller cancelled
finally carried forward
```

Then verify, in order:

```
trips.seats_booked      matches SUM(seats) over REQUESTED + CONFIRMED bookings
bookings.refunded_paise matches SUM(amount_paise) over PROCESSED refunds
customer credit balance matches SUM(amount_paise) over their entries
HELD                    paid − refunded − credit, and ≥ 0
```

Every one of those is a derivation, not a stored total — which is why they
can be checked against each other at all.

---

## Watching it

```bash
npm run test:state coonoor-test-bench-test    # trip, holds, bookings, payments, refunds, emails
npm run test:webhook -- DOT-CO26-0001 --event=refund.failed
npm run test:reset                            # wipe all three TEST trips
```

The reset is scoped to a hardcoded allowlist and refuses any trip not titled
`(TEST)`. It does **not** clear travel credit — the ledger belongs to the
customer, not the trip. Clear it by hand if you want a clean slate:

```sql
DELETE FROM credit_entries WHERE profile_id = '<id>';
```

| | |
|---|---|
| Razorpay refunds | dashboard → **Transactions → Refunds** |
| Webhook deliveries | dashboard → **Settings → Webhooks** |
| Emails | `email_log`, or the Resend dashboard |
| Credit ledger | `/admin/credit` |

---

## What test mode still can't show

- **A genuine failed refund.** C9 forces it by replay; a real one is a bank
  rejection you cannot induce.
- **Refund arrival.** Razorpay tells you when a refund was *sent*
  (`refund.processed`); nothing tells anyone when it *lands*. That is why
  both the email and the booking page say 5–7 working days and invite a
  reply.
- **The real gateway fee** on older bookings. `payments.amount_paise` means
  the order amount on new payments and the gross charged on ones taken before
  the fee-bearer change — which is why the refund ceiling is floored at what
  the booking was actually credited.
