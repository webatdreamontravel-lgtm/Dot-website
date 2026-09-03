# Valparai Full Run — every case, one at a time

A single trip priced so the arithmetic never gets in the way, and a list to
work down in order. Later cases depend on state the earlier ones leave
behind, so skipping one throws the numbers off.

```bash
npm run test:seed                          # (re)creates the trip
npm run test:state valparai-full-run-test  # everything it touches, one screen
```

**Valparai Full Run (TEST)** — 10 seats · **₹60,000 a seat, no tax** ·
advance **₹30,000** · balance **₹30,000** · departs in ~45 days.
References look like `DOT-VA26-…`.

Why no GST on this one: ₹60,000 *including* 5% would need a base of
₹57,142.857, which doesn't exist. The nearest base drifts by a rupee or two
above three seats, and a stray rupee on a test trip reads as a bug and costs
an hour. Every party size here is an exact multiple of ₹60,000. GST rounding
is already covered by the other three test trips.

45 days is clear of all three reminder windows (21, 14, and the final five),
so the nightly cron never changes state under you.

### The four numbers everything is measured from

```
paid       amount_paid_paise            what they handed over. Never decreases.
refunded   refunded_paise               SUM of PROCESSED refunds. Recomputed, never incremented.
credit     SUM(ISSUED on this booking)  money that left for the customer's ledger
──────────────────────────────────────────────────────────────────────────────
HELD       paid − refunded − credit     what this booking still has of theirs
```

**Restart the dev server after any migration.** `prisma generate` alone leaves
the running process with a stale client.

---

## A · Money in, through checkout

**A1 · Advance, one seat.**
Book one seat, choose **Advance**, pay ₹30,000 in Razorpay test mode.
Expect: booking `CONFIRMED`, paid ₹30,000, balance ₹30,000, `seats_booked` 1.
Two payment rows arrive over the webhook — `created` then `captured`; only
the captured one counts.
Check `/account/bookings/<ref>` says **"Payment received — you're booked"**
and names the ₹30,000 still due. It must *not* say "nothing has been charged".

**A2 · Pay the balance online.**
From the same booking's customer page, pay the ₹30,000 balance.
Expect: paid ₹60,000, balance ₹0, still `CONFIRMED`, **`seats_booked` still 1**.
This is the one that used to claim a second seat — check the counter twice.

**A3 · Full amount, two seats.**
New booking, 2 seats, choose **Full amount** → ₹1,20,000.
Expect: paid ₹1,20,000, balance ₹0, `seats_booked` now 3.

**A4 · Abandon the popup.**
Start a booking, open Razorpay, close it without paying.
Expect: booking stays `PENDING_PAYMENT`, a live row in `seat_holds`,
`seats_booked` unchanged, and the page says the seats are held for 15 minutes.

**A5 · Let the hold lapse.**
Age that hold, then run the cron:
```bash
psql "$DATABASE_URL" -c "UPDATE seat_holds SET expires_at = now() - interval '1 hour' WHERE booking_id = '<id>';"
psql "$DATABASE_URL" -c "UPDATE bookings SET hold_expires_at = now() - interval '1 hour' WHERE id = '<id>';"
curl -H "Authorization: Bearer $(grep CRON_SECRET .env.local | cut -d= -f2 | tr -d '\"')" \
  http://localhost:3009/api/cron/release-holds
```
Expect `{"ok":true,"holdsReleased":1,"bookingsExpired":1}` and the booking
now `EXPIRED`. **Both** columns must be aged — `bookingsExpired: 0` means you
only did the first one.

**A6 · Sold out.**
Fill to 10 seats, then try to book one more.
Expect: refused before Razorpay opens, with a seats message, not a crash.

**A7 · Late authorisation.**
Start a booking, let the hold expire (A5), *then* complete the payment in the
still-open Razorpay window.
Expect: money captured, booking lands `REQUESTED` not `CONFIRMED`, no seat
claimed, and the seat-unavailable email to both customer and admin. The
customer page must say plainly that a person will call — not show a bare
status badge.

**A8 · Failed payment.**
Use Razorpay's failure card.
Expect: no booking confirmed, no seat taken, hold still live, and the error
readable on screen.

**A9 · Copy sweep.**
Walk checkout again without paying and read every sentence. On this trip
(Razorpay on) nothing may say *"nothing is charged"*, *"no payment is taken
online"*, or *"the team will collect it directly"*. Four places used to:
the price box on the book page, the reassurance line under it, the review
step header, and the summary panel footer.

---

## B · Money the team takes by hand

**B1 · Cash on a request.**
Create a booking from **Admin → Bookings → New**, status `REQUESTED`, no
payment. Then record ₹30,000 cash on it.
Expect: status flips to `CONFIRMED` by itself, `confirmed_at` stamped,
seats claimed, and a payment-received email out.

**B2 · Overpay refused.**
On a booking owing ₹30,000, try to record ₹40,000.
Expect: *"Only ₹30,000 is outstanding on this booking."* Nothing written.

**B3 · Nothing left to record.**
Open a fully-paid booking.
Expect: no form at all — *"This booking is paid in full."*

**B4 · Split across methods.**
On a fresh 1-seat booking: ₹10,000 cash, ₹10,000 UPI (with a UTR), ₹10,000
bank transfer.
Expect: paid ₹30,000, three payment rows each with its own method and
reference, and the customer page showing the split.

---

## C · Refunds

**C1 · Raise a Razorpay refund.**
On a booking holding ₹60,000, refund ₹20,000 through Razorpay.
Expect: a `PENDING` refund row, `refunded_paise` **still ₹0** — pending money
hasn't moved — and the admin showing it as in progress.

**C2 · Carry-forward is blocked while it's pending.** ← new
With C1 still pending, set that booking's status to **Carried forward**.
Expect: the credit fields never appear, the button is disabled, and the panel
says *"₹20,000 is on its way back through Razorpay…"*. Then confirm the
server refuses it too — the panel is a courtesy, not the guard.

**C3 · Land the refund.**
```bash
npm run test:webhook -- --event=refund.processed --amount=20000
```
Expect: refund `PROCESSED`, `refunded_paise` ₹20,000, HELD ₹40,000,
**two emails** — the customer's *"₹20,000 refunded"* and the new admin
*"Refund sent — DOT-VA26-… (₹20,000)"* carrying what's still held.
Replay the same webhook: nothing changes and no second email.
Then retry C2 — carry-forward is available again.

**C4 · A refund that fails.**
```bash
npm run test:webhook -- --event=refund.failed --fresh
```
Expect: refund `FAILED`, `refunded_paise` unchanged, **admin-only** alert.
The customer must hear nothing — they were never told it had gone.

**C5 · Returned by hand.**
Refund ₹5,000 by cash with a reference.
Expect: a `PROCESSED` refund with method `CASH`, no Razorpay call, and the
customer page saying *"In cash"* — not *"back to the account you paid from"*.

**C6 · The two ceilings.**
On a booking paid ₹40,000 by Razorpay and ₹20,000 in cash, with ₹20,000
already refunded through Razorpay:
- Razorpay refund box caps at **₹20,000** (gateway received ₹40,000, sent ₹20,000).
- By-hand box caps at what's still HELD.
Check both, and that neither lets you exceed the other's money.

**C7 · Refund everything.**
Return the remainder, then mark the booking `REFUNDED`.
Expect: HELD ₹0, and the customer page saying the full amount went back.

---

## D · Status

**D1 · Request → confirmed.** Email out, seat claimed.

**D2 · Confirmed → cancelled.** Reason saved, seat returned to the trip,
cancellation email out, `cancelled_at` stamped.

**D3 · Carry forward.**
On a booking holding ₹60,000, carry ₹55,000 forward with a ₹5,000
cancellation charge.
Expect: status `CARRIED_FORWARD`, seat released, one `ISSUED` ledger entry of
₹55,000, credit-issued email out. **`amount_paid_paise` does not change** —
the money moved to the ledger, it wasn't un-paid.

**D4 · A closed booking is locked.** ← new
Open the D3 booking. Expect no dropdown at all — just the status chip and the
reason. Same for `CANCELLED`, `REFUNDED`, `PARTIALLY_REFUNDED`, `EXPIRED`.
Note what this costs you: **a cancelled booking can no longer be marked
Refunded**. That was the deliberate choice; see whether it bites in practice.

**D5 · Carry forward twice.** ← new
Try to move the D3 booking back to `CONFIRMED` and carry it forward again.
Expect: refused at the status step. Before this, it minted the credit twice
from the same money.

**D6 · The button.** ← new
On an open booking, before changing anything the Update button should be a
flat grey with *"Choose a different status"* beneath it — obviously inert.
Pick a different status and it turns solid teal. Neither state should look
like a faded version of the other.

---

## E · Travel credit

**E1 · The credit page.** ← new
`/admin/credit`. Expect a table of name, phone, email and balance; clicking a
row opens that customer's ledger in place; two rows can be open at once.
Search by name, by phone, by part of an email. Confirm **the three stat cards
never change when you search** — outstanding is a business figure, not a
search result. Switch *Balance* to **Fully used** and **Everyone**.

**E2 · Spend credit on a balance.** ← new
On a booking owing ₹30,000 belonging to the D3 customer, open *Record a
payment*. Expect a green panel naming their credit, **Travel credit** in the
method dropdown, and the UTR field disabled when it's selected.
Apply ₹30,000. Expect: paid up by ₹30,000, a `REDEEMED` ledger entry of
−₹30,000, a payment row with method `CREDIT`, balance ₹0.

**E3 · Capped at the balance.** ← new
Same customer, a booking owing only ₹10,000 while they hold ₹25,000.
Expect the link to read **"Put ₹10,000 towards this"** and fill 10,000 — not
25,000. Applying more than the balance must be refused.

**E4 · Overspend refused.**
Type more credit than they hold. Expect *"Only ₹X of travel credit is
available"* and nothing written.

**E5 · Credit on a brand-new booking.**
Admin → Bookings → New, pick that customer, method **Travel credit**.
Expect it applied at creation, booking `CONFIRMED`.

**E6 · Not transferable.**
Confirm someone else's booking never offers this customer's credit.

---

## F · Cron

**F1 · Release holds.** Covered in A5. Run it again with nothing to do and
expect zeros, not an error.

**F2 · Balance reminders.**
Age the trip into the window, then run the reminder cron:
```bash
psql "$DATABASE_URL" -c "UPDATE trips SET start_date = current_date + 3 WHERE slug = 'valparai-full-run-test';"
```
Expect one email per unpaid booking, `sent` counting only what actually went.
Run it twice — the second run must report `deduped`, not `sent: 1`.
**Put the date back afterwards** (`current_date + 45`).

---

## G · Admin screens

**G1 · Dashboard.** ← new Click the trip in *Seats filling up* — it must land
on that trip's **bookings**, not its edit form.

**G2 · Trip status.** ← new Edit the trip. The dropdown offers **Draft** and
**Live on site** only. Archived is gone.

**G3 · Archive it anyway.** Turn the **Active** switch off in the trips list.
Expect the trip archived and off the site; turn it back on and it returns to
Live. Now open its edit form — because it's archived, *Archived* appears in
the dropdown so saving can't silently demote it to Draft.

**G4 · Trip stats ignore filters.** On the trips list and a trip's bookings,
apply a filter. The stat cards must not move; only the result count does.

---

## H · Edge cases worth hunting

**H1 · Two admins, one credit balance.**
Two browser windows on the same customer, both applying the same credit.
Expect the second to fail with the ledger's own message, not to succeed.
The row lock in `redeemCredit` is what's under test.

**H2 · Two customers, one last seat.**
Both in checkout on the final seat; both pay.
Expect one confirmed and one seat-lost (A7), never `seats_booked` 11.

**H3 · Webhook replay.**
Re-send any `payment.captured` you've already processed.
Expect no second payment row, no second seat, no second email.

**H4 · Refund more than paid.**
Try it in both refund boxes. Both must refuse; the database constraint is the
backstop, not the plan.

**H5 · Drop a traveller.**
Cancel one seat on a 3-seat booking.
Expect: re-priced to ₹1,20,000 at the **frozen** unit price, seat returned,
traveller row kept with `cancelled_at` rather than deleted.

**H6 · Credit plus cash on one booking.**
₹20,000 credit then ₹40,000 cash. Expect paid ₹60,000 and the customer page
showing the split honestly.

**H7 · A refund *and* an outstanding balance. — known gap**
Booking paid ₹60,000, refund ₹10,000, still `CONFIRMED`.
The stat card will offer a ₹10,000 balance and *Record a payment* will answer
**"already paid in full"** — the panel measures `total − paid + refunded`,
the server measures `total − paid`. Two definitions of owed. Confirm you can
reproduce it, then decide whether to fix it.

**H8 · Book a DRAFT trip from admin.**
Currently refused by `reserve_seats`. Worth confirming, since seating
carried-forward people before going live is something you've wanted.
