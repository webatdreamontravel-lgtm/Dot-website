-- Balance reminders: daily in the final stretch, and chase every amount.
--
-- Two changes to how this works:
--
--   dailyFinalDays  a reminder every morning for the last N days before
--                   departure, until the balance is cleared. Fixed one-off
--                   reminders are easy to ignore; a daily one the week of the
--                   trip is what actually gets people to pay.
--
--   minBalancePaise now 0 — chase every balance, however small. Previously
--                   ₹100, which quietly let small amounts go uncollected.

UPDATE "site_settings"
   SET "value" = '{"enabled": true, "daysBefore": [21, 14], "dailyFinalDays": 5, "minBalancePaise": 0}'::jsonb,
       "updated_at" = now()
 WHERE "key" = 'balance_reminder';

INSERT INTO "site_settings" ("key", "value", "updated_at")
VALUES (
  'balance_reminder',
  '{"enabled": true, "daysBefore": [21, 14], "dailyFinalDays": 5, "minBalancePaise": 0}'::jsonb,
  now()
)
ON CONFLICT ("key") DO NOTHING;
