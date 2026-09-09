-- Splits "is this trip on the homepage" from "is it the big card".
--
-- Defaults true: before this column existed every published, active,
-- upcoming trip appeared in the homepage rail, so true is what preserves
-- the behaviour for the rows already there. Nothing changes on the site
-- until a trip is explicitly unticked.
ALTER TABLE "trips"
  ADD COLUMN IF NOT EXISTS "show_on_homepage" BOOLEAN NOT NULL DEFAULT true;

-- The rail reads published + active + on-homepage, ordered by the big card
-- first. Same shape as the existing publishing index, plus the new column.
CREATE INDEX IF NOT EXISTS "trips_show_on_homepage_idx"
  ON "trips" ("show_on_homepage", "is_active", "status", "start_date");
