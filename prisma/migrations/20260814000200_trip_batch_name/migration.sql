-- Internal label to distinguish repeat runs of the same trip,
-- e.g. "Rajasthan 2026 · Batch 1". Admin-only, never shown publicly.
ALTER TABLE "trips" ADD COLUMN "batch_name" TEXT;

-- Supports the admin search, which matches title and batch name together.
CREATE INDEX IF NOT EXISTS trips_batch_name_idx ON "trips" ("batch_name");
