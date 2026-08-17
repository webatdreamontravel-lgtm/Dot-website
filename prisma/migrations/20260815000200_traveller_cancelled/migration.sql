-- Cancelling a seat used to delete the traveller row outright.
--
-- That lost the record of who was on the booking, and left the booking's
-- seat count out of step with the people shown against it: removing the
-- last traveller cancelled the booking but left seats at its old value,
-- so the page read "1 seat" with nobody listed.
--
-- Keeping the row and stamping cancelled_at lets the booking show who was
-- originally travelling, greyed out, and lets seats be derived from the
-- travellers who are still going.

ALTER TABLE "booking_travellers"
  ADD COLUMN "cancelled_at" timestamptz(3);
