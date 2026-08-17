-- Trip moodboard: a few 0-5 ratings (Leisure, Adventure, Physical Effort …)
-- that tell a reader at a glance what kind of trip this is.
--
-- JSONB rather than a table: it's display-only content, never queried or
-- aggregated, and the set of dimensions varies per trip.
ALTER TABLE "trips" ADD COLUMN "moodboard" JSONB;
