-- Split one notes column into two, by author.
--
-- `internal_notes` had five writers: the customer at checkout, the admin's
-- own box, the admin's new-booking form, and two system paths that stamp a
-- warning onto a booking (settlement losing a seat, and an order being
-- superseded). All of it landed in one field, displayed under one heading —
-- so the customer's message read as an internal note, and the admin's edit
-- box silently overwrote whatever they had written.
--
-- After this:
--   customer_notes   what the customer typed. Never written by the team.
--   internal_notes   the team's own notes, and the system's warnings.

ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "customer_notes" TEXT;

-- Move the notes that came from a customer.
--
-- A WEB booking's note is the customer's, EXCEPT the two the system writes
-- itself — matched on their exact opening text, both of which are ours:
--   "Superseded — …"  createOrder, when a customer restarts checkout
--   "⚠ Paid, but …"   settlePayment, when the seat had gone
UPDATE "bookings"
   SET "customer_notes" = "internal_notes",
       "internal_notes" = NULL
 WHERE "internal_notes" IS NOT NULL
   AND "source" = 'WEB'
   AND "internal_notes" NOT LIKE 'Superseded %'
   AND "internal_notes" NOT LIKE '⚠ %';

COMMENT ON COLUMN "bookings"."customer_notes" IS
  'Anything the customer wrote at checkout. Read-only to the team: it is their words, not ours.';
COMMENT ON COLUMN "bookings"."internal_notes" IS
  'The team''s own notes, plus warnings the system stamps on a booking.';
