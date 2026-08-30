# The four settlement paths

A quick reference. Full detail is in [payments.md](./payments.md).

When a payment arrives, `settlePayment()` asks one question: **does the
booking still point at a usable hold?** Everything below follows from that.

---

| | Cause | State on arrival | Branch taken | Outcome |
|---|---|---|---|---|
| **A** | Paid within 15 min — *the normal case* | hold **live** | `confirm_seat_hold()` | seat counted → `CONFIRMED` |
| **B** | Payment took >15 min; cron hasn't swept yet | hold **lapsed**, `pendingHoldId` still set | `confirm_seat_hold()` | seat counted → `CONFIRMED` |
| **C** | Webhook retried long after payment | hold **released**, `pendingHoldId` NULL | direct `UPDATE trips` | seat counted → `CONFIRMED` |
| **D** | Same as C, but the trip filled meanwhile | hold **released**, trip **full** | direct `UPDATE trips` | **not oversold** → parked `REQUESTED` |

---

### A — the normal case

Hold is live, `confirm_seat_hold()` does its job. Roughly 85–95 of every 100
successful payments.

### B — late, but there's still room

`confirm_seat_hold()` deliberately **forgives an expired hold when the trip
has room**. It refuses only when the hold is expired *and* the trip is full.
Being two minutes late costs nothing.

### C — Late Auth

Razorpay's term for the bank authorising after our order session expired.
Also covers a webhook retried after a deploy — Razorpay retries for **24
hours**.

By then the cron may have released the hold and cleared `pendingHoldId`, so
there is nothing to confirm. Without the direct claim the booking would be
marked `CONFIRMED` with the seat never counted — the trip believing it still
had a seat it had actually sold. **Silent oversell.**

The claim is guarded so it can only take a seat that exists:

```sql
UPDATE trips SET seats_booked = seats_booked + n
 WHERE id = ... AND seats_booked + n <= total_seats
```

**What the customer sees between paying and the webhook landing:**

| Time | Status | Page says |
|---|---|---|
| 10:00 | `PENDING_PAYMENT` | "Your seats are held until payment comes through." |
| 10:20 | `EXPIRED` | she paid 20 min ago and sees this |
| 10:40 | `CONFIRMED` | "You're in." — seat counted, email sent |

Which is why the `EXPIRED` copy is written for two readers: it says payment
wasn't received, then adds that a payment already made can take a few minutes
and will confirm itself.

### D — paid, no seat

Zero rows changed means the trip is genuinely full. There is **no correct
automatic answer** — refunding silently would be worse than telling someone.

So: money recorded, booking parked as `REQUESTED`, `internal_notes` explains
it, and two emails go out at once.

| To | Template | Says |
|---|---|---|
| Customer | `booking_seat_unavailable` | Payment received, seat gone, our fault, money is safe, we'll call within a working day with the next departure or a full refund |
| Team | `admin_seat_unavailable` | Reference, amount, customer contact, link to the admin booking |

`REQUESTED` normally means *"we'll ring you to collect payment"* — exactly the
wrong thing to tell someone who has already paid. So the customer-facing copy
is derived from the amount paid, not the status alone:

- `REQUESTED` + paid **₹0** → *"Request received. Our team will contact you to arrange payment."*
- `REQUESTED` + paid **> ₹0** → *"Payment received. The last seat was taken moments before it reached us…"*

---

## How likely is each?

Path D needs a conjunction: a delayed webhook, **and** no browser callback,
**and** a trip that is exactly full at that moment. On 16–20 seat trips
selling over weeks, that last condition is the rare one — plausibly never.

It was still worth fixing, because it failed **silently**. Nothing would have
alerted anyone. You would have found a trip with a seat it thought was free
and already sold, with no way to work out why.

---

All four are covered by tests. See the Testing section of
[payments.md](./payments.md).
