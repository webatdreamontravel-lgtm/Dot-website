-- Refunds the team makes by hand: cash back across a table, a GPay transfer,
-- a bank deposit.
--
-- Until now every refund went through Razorpay, so the method was implicit.
-- It no longer is, and the difference matters beyond bookkeeping: a Razorpay
-- refund is asynchronous and sits PENDING until a webhook confirms it, while
-- money already handed over is PROCESSED the moment it is recorded. The
-- customer email differs too — "5 to 7 working days" is meaningless for cash
-- that is already in their hand.
DO $$ BEGIN
  CREATE TYPE "RefundMethod" AS ENUM ('RAZORPAY', 'CASH', 'UPI', 'BANK_TRANSFER', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Defaulting to RAZORPAY is correct for backfill as well as for new rows:
-- every refund that predates this column was one.
ALTER TABLE "refunds"
  ADD COLUMN IF NOT EXISTS "method" "RefundMethod" NOT NULL DEFAULT 'RAZORPAY',
  ADD COLUMN IF NOT EXISTS "external_reference" TEXT;
