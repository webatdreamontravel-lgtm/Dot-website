-- A master on/off switch, above status.
--
-- `status` says where a trip is in its editorial life: DRAFT while it's being
-- written, PUBLISHED once it's finished, ARCHIVED when it's history. That is
-- useful, but it conflates "this trip is ready" with "this trip should be
-- visible right now" — and taking a finished trip off the site temporarily
-- meant demoting it back to DRAFT, which loses the distinction between a trip
-- being written and one deliberately pulled.
--
-- is_active is the higher-precedence flag: an inactive trip is invisible
-- regardless of status. A trip must be BOTH published AND active to appear.
--
-- Defaults true so every existing trip keeps behaving exactly as it did.

ALTER TABLE "trips" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

-- The public list filters on status + is_active + dates together.
CREATE INDEX "trips_active_status_start_idx"
  ON "trips"("is_active", "status", "start_date");

-- ─────────────────────────────────────────────────────────────
-- Online payment is now the default rather than opt-in.
--
-- The per-trip toggle existed to roll Razorpay out one trip at a time while
-- it was unproven. It is proven, and leaving it off by default means a new
-- trip silently cannot take money — a failure mode nobody notices until a
-- customer complains. The column stays so a single trip can still be forced
-- offline from SQL if a specific batch ever needs it.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "trips" ALTER COLUMN "razorpay_enabled" SET DEFAULT true;
UPDATE "trips" SET "razorpay_enabled" = true WHERE "razorpay_enabled" = false;
