-- Refunds: money going back out, as its own append-only table.
--
-- payments.razorpay_refund_id could only remember one refund per payment, so
-- a second partial refund silently overwrote the first and the trail was
-- lost. That column stays for now (older rows reference it) but new writes
-- go here.

CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

CREATE TABLE "refunds" (
  "id"                      UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  "payment_id"              UUID           NOT NULL,
  "booking_id"              UUID           NOT NULL,
  "amount_paise"            INTEGER        NOT NULL,
  "status"                  "RefundStatus" NOT NULL DEFAULT 'PENDING',
  "razorpay_refund_id"      TEXT,
  "reason"                  TEXT,
  "notes"                   TEXT,
  "initiated_by_profile_id" UUID,
  "failure_reason"          TEXT,
  "processed_at"            TIMESTAMPTZ(3),
  "created_at"              TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updated_at"              TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

  CONSTRAINT "refunds_payment_fk" FOREIGN KEY ("payment_id")
    REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "refunds_booking_fk" FOREIGN KEY ("booking_id")
    REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "refunds_initiator_fk" FOREIGN KEY ("initiated_by_profile_id")
    REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE,

  -- Direction is the table, never the sign. A negative refund would quietly
  -- become a payment when summed.
  CONSTRAINT "refunds_amount_positive" CHECK ("amount_paise" > 0)
);

CREATE UNIQUE INDEX "refunds_razorpay_refund_id_key"
  ON "refunds"("razorpay_refund_id");
CREATE INDEX "refunds_booking_created_idx"  ON "refunds"("booking_id", "created_at");
CREATE INDEX "refunds_status_created_idx"   ON "refunds"("status", "created_at");
CREATE INDEX "refunds_payment_idx"          ON "refunds"("payment_id");

-- RLS on with no policies: Prisma connects as the owner and bypasses it, but
-- this stops Supabase's auto-generated PostgREST API exposing refunds to
-- anyone holding the public anon key. Same posture as every other table here.
ALTER TABLE "refunds" ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- Never refund more than was taken.
--
-- bookings.refunded_paise already has a CHECK against amount_paid_paise, but
-- that guards the denormalised total, not the rows it is supposed to be the
-- sum of. Without this a bug could insert refund rows adding up to more than
-- the booking was ever paid while the column stayed within bounds and looked
-- fine. Enforced per-statement in a trigger because a CHECK cannot aggregate
-- across rows.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION refunds_within_paid() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_paid      int;
  v_refunded  int;
BEGIN
  SELECT "amount_paid_paise" INTO v_paid
    FROM "bookings" WHERE "id" = NEW."booking_id" FOR UPDATE;

  -- FAILED refunds never left the account, so they don't count against it.
  SELECT COALESCE(SUM("amount_paise"), 0) INTO v_refunded
    FROM "refunds"
   WHERE "booking_id" = NEW."booking_id"
     AND "status" <> 'FAILED'
     AND "id" <> NEW."id";

  IF (v_refunded + NEW."amount_paise") > v_paid THEN
    RAISE EXCEPTION
      'refunds (% paise) would exceed the % paise paid on this booking',
      v_refunded + NEW."amount_paise", v_paid
      USING ERRCODE = 'P0001', HINT = 'REFUND_EXCEEDS_PAID';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER refunds_within_paid_trg
  BEFORE INSERT OR UPDATE OF "amount_paise", "status" ON "refunds"
  FOR EACH ROW EXECUTE FUNCTION refunds_within_paid();

-- Prisma writes updated_at itself, but a raw SQL correction shouldn't be able
-- to leave it stale.
CREATE OR REPLACE FUNCTION refunds_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."updated_at" = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER refunds_touch_updated_at_trg
  BEFORE UPDATE ON "refunds"
  FOR EACH ROW EXECUTE FUNCTION refunds_touch_updated_at();
