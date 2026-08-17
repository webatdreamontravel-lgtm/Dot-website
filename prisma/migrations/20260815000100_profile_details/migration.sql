-- Signup now collects city, state, date of birth and gender.
--
-- All four are nullable: the form requires them, but accounts that predate
-- this migration (and any created by the make-admin CLI) have none, and a
-- NOT NULL would either fail the migration or force a fake default onto
-- real people.

CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

ALTER TABLE "profiles"
  ADD COLUMN "city"          text,
  ADD COLUMN "state"         text,
  ADD COLUMN "date_of_birth" date,
  ADD COLUMN "gender"        "Gender";
