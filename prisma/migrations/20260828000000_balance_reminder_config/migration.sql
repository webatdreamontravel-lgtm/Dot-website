-- When balance reminders go out.
--
-- In site_settings rather than in code so the schedule can be changed without
-- a deploy — the right cadence is something you learn after a few trips.
--
--   daysBefore      a reminder is sent when a trip is exactly this many days
--                   away, so [21, 7, 2] means three reminders
--   minBalancePaise don't chase less than this; the email costs more goodwill
--                   than the rupees are worth

INSERT INTO "site_settings" ("key", "value", "updated_at")
VALUES (
  'balance_reminder',
  '{"enabled": true, "daysBefore": [21, 7, 2], "minBalancePaise": 10000}'::jsonb,
  now()
)
ON CONFLICT ("key") DO NOTHING;
