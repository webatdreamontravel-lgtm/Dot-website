-- The payment-gateway fee, passed to the customer.
--
-- Razorpay takes ~2% + 18% GST on that fee. We recover it as a convenience
-- fee, but ONLY on online payments — cash and bank transfers recorded by the
-- team cost nothing to process and carry none.
--
-- The fee belongs to the PAYMENT, not the booking. bookings.total_paise stays
-- what DOT earns from the trip and does not change because someone chose a
-- card over cash. Critically, the fee must never count toward what the
-- customer owes: amount_paid_paise is credited with
-- (amount_paise - convenience_fee_paise), or every online booking would look
-- overpaid and the balance arithmetic would drift.

-- amount_paise now means the GROSS — what the customer was actually charged.
-- Existing rows carry a zero fee, so gross already equals the booking portion
-- and nothing needs backfilling.
ALTER TABLE "payments"
  ADD COLUMN "convenience_fee_paise" INTEGER NOT NULL DEFAULT 0,
  -- Basis points, snapshotted at charge time. 236 = 2.36%. Changing the rate
  -- later must not rewrite what an old payment actually charged — the same
  -- discipline as gst_percent on bookings.
  ADD COLUMN "convenience_fee_rate_bp" INTEGER;

-- A negative fee would silently credit the booking with more than was taken.
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_convenience_fee_nonneg"
  CHECK ("convenience_fee_paise" >= 0);

-- The fee can never exceed what was charged; the booking portion would go
-- negative and the customer would appear to owe more after paying.
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_fee_within_amount"
  CHECK ("convenience_fee_paise" <= "amount_paise");

-- The rate, editable without a deploy. site_settings already exists for
-- exactly this. enabled:false switches the fee off everywhere.
INSERT INTO "site_settings" ("key", "value", "updated_at")
VALUES (
  'convenience_fee',
  '{"enabled": true, "rateBp": 236, "label": "Convenience fee"}'::jsonb,
  now()
)
ON CONFLICT ("key") DO NOTHING;
