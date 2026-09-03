-- Remember which hold a PENDING_PAYMENT booking is standing on.
--
-- confirm_seat_hold() looks the hold up by id and requires booking_id IS NULL,
-- so the seat_holds -> bookings link can't be written until the moment of
-- confirmation. That leaves a gap in the online-payment flow: the hold is
-- taken when the Razorpay order is created, and confirmed minutes later when
-- the webhook lands, with nothing in between tying the two together.
--
-- Inferring it (newest unlinked hold for this profile and trip) would work
-- only while a customer never has two pending bookings on one trip. That is
-- true today because the flow reuses an existing pending booking, but it is
-- an invariant enforced nowhere. Store the id instead.
--
-- Cleared on confirmation, so a non-null value always means "seats held,
-- money not yet in".

ALTER TABLE "bookings" ADD COLUMN "pending_hold_id" UUID;

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_pending_hold_fk" FOREIGN KEY ("pending_hold_id")
  REFERENCES "seat_holds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Partial: only pending bookings carry one, and that is the only set we scan.
CREATE INDEX "bookings_pending_hold_idx"
  ON "bookings"("pending_hold_id") WHERE "pending_hold_id" IS NOT NULL;
