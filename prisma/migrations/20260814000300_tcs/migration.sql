-- Tax Collected at Source on overseas tour packages.
--
-- Kept separate from GST: different rate, different statutory treatment, and
-- it must appear as its own line on the invoice. Domestic trips leave it 0.
ALTER TABLE "trips"    ADD COLUMN "tcs_percent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "bookings" ADD COLUMN "tcs_percent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "bookings" ADD COLUMN "tcs_paise"   INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "trips"
  ADD CONSTRAINT trips_tcs_range CHECK ("tcs_percent" BETWEEN 0 AND 100);

ALTER TABLE "bookings"
  ADD CONSTRAINT bookings_tcs_nonneg CHECK ("tcs_paise" >= 0 AND "tcs_percent" BETWEEN 0 AND 100);
