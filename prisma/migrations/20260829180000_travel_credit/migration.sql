-- Travel credit: money kept from a cancelled booking and spent on a later one.
--
-- CARRIED_FORWARD is a distinct booking status rather than a flavour of
-- REFUNDED because nothing was refunded — the cash never left, refunded_paise
-- stays 0, and the trip's "owed to them" must not count it.
--
-- CREDIT is a payment method so that spending credit flows through the same
-- path as cash: booking totals, balances, reminders and reports all work on
-- it with no new arithmetic.
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'CARRIED_FORWARD';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'CREDIT';

DO $$ BEGIN
  CREATE TYPE "CreditKind" AS ENUM ('ISSUED', 'REDEEMED', 'ADJUSTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Append-only. A customer's balance is SUM(amount_paise) over their rows and
-- is never stored: a cached total that can disagree with its own ledger is
-- unfixable after the fact, because nothing says which of the two lied.
--
-- Amounts are SIGNED so the balance is one aggregate with no special cases.
-- Deliberately no CHECK on the sign per kind: an ADJUSTED row legitimately
-- goes either way, and constraining ISSUED/REDEEMED separately would buy
-- nothing the application layer doesn't already guarantee.
CREATE TABLE IF NOT EXISTS "credit_entries" (
  "id"                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "kind"                  "CreditKind" NOT NULL,
  "profile_id"            UUID NOT NULL,
  "amount_paise"          INTEGER NOT NULL,
  "source_booking_id"     UUID,
  "applied_booking_id"    UUID,
  "note"                  TEXT,
  "created_by_profile_id" UUID,
  "created_at"            TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

  CONSTRAINT "credit_entries_amount_nonzero" CHECK ("amount_paise" <> 0),
  CONSTRAINT "credit_entries_profile_fk"
    FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "credit_entries_source_fk"
    FOREIGN KEY ("source_booking_id") REFERENCES "bookings"("id") ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT "credit_entries_applied_fk"
    FOREIGN KEY ("applied_booking_id") REFERENCES "bookings"("id") ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT "credit_entries_creator_fk"
    FOREIGN KEY ("created_by_profile_id") REFERENCES "profiles"("id") ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "credit_entries_profile_id_created_at_idx"
  ON "credit_entries" ("profile_id", "created_at");
CREATE INDEX IF NOT EXISTS "credit_entries_source_booking_id_idx"
  ON "credit_entries" ("source_booking_id");
CREATE INDEX IF NOT EXISTS "credit_entries_applied_booking_id_idx"
  ON "credit_entries" ("applied_booking_id");

-- Same lockdown as every other table: Prisma connects as owner and bypasses
-- RLS, so this exists only to stop Supabase's auto-generated PostgREST API
-- exposing the table to anyone holding the public anon key.
ALTER TABLE "credit_entries" ENABLE ROW LEVEL SECURITY;

-- A balance can never go negative. The application checks before spending,
-- but two admins redeeming at once could both pass that check — this is the
-- backstop that makes overspending impossible rather than merely unlikely.
CREATE OR REPLACE FUNCTION credit_balance_nonnegative() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_balance bigint;
BEGIN
  SELECT COALESCE(SUM("amount_paise"), 0) INTO v_balance
    FROM "credit_entries" WHERE "profile_id" = NEW."profile_id";

  IF v_balance < 0 THEN
    RAISE EXCEPTION 'travel credit balance would go negative (% paise)', v_balance
      USING ERRCODE = 'P0001', HINT = 'CREDIT_INSUFFICIENT';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "credit_entries_balance_guard" ON "credit_entries";
CREATE CONSTRAINT TRIGGER "credit_entries_balance_guard"
  AFTER INSERT ON "credit_entries"
  DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW EXECUTE FUNCTION credit_balance_nonnegative();
