/**
 * Proves the seat-reservation machinery cannot oversell under concurrency.
 *
 * The naive read-then-write is broken: N racers all read "seats available"
 * and all succeed. This fires many simultaneous reserve_seats() calls at a
 * trip with a small capacity and asserts that EXACTLY capacity succeed.
 *
 *   node --env-file=.env.local scripts/test-capacity.mjs
 *
 * Creates and removes its own fixtures. Safe to run against a dev database.
 */
import pg from "pg";

const { Pool } = pg;

const SEATS = 3;
const RACERS = 12;

const pool = new Pool({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  max: RACERS + 2,
});

const q = (text, params) => pool.query(text, params);
let failures = 0;

function check(label, pass, detail = "") {
  console.log(`${pass ? "  ok  " : " FAIL "} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!pass) failures++;
}

/** Removes every fixture this script has ever created, in FK order. */
async function cleanup() {
  await q(`DELETE FROM payments  WHERE booking_id IN (SELECT b.id FROM bookings b JOIN trips t ON t.id = b.trip_id WHERE t.slug LIKE 'capacity-test-%')`);
  await q(`DELETE FROM seat_holds WHERE trip_id IN (SELECT id FROM trips WHERE slug LIKE 'capacity-test-%')`);
  await q(`DELETE FROM bookings   WHERE trip_id IN (SELECT id FROM trips WHERE slug LIKE 'capacity-test-%')`);
  await q(`DELETE FROM trips      WHERE slug LIKE 'capacity-test-%'`);
  await q(`DELETE FROM auth.users WHERE email LIKE 'capacity-test-%@example.test'`);
}

async function main() {
  // Clear anything a previous interrupted run left behind.
  await cleanup();

  // ── 1. Structure ────────────────────────────────────────────────────
  console.log("\nSchema");
  // _prisma_migrations is Prisma's own bookkeeping table, hence 14 + 1.
  const { rows: tables } = await q(`
    SELECT tablename, rowsecurity FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
    ORDER BY tablename`);
  check("14 tables created", tables.length === 14, `found ${tables.length}`);
  const noRls = tables.filter((t) => !t.rowsecurity).map((t) => t.tablename);
  check("RLS enabled on every table", noRls.length === 0, noRls.join(", ") || "all locked");

  const { rows: fns } = await q(`
    SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND proname = ANY($1)`,
    [["reserve_seats", "confirm_seat_hold", "release_seats", "release_expired_holds", "next_booking_reference", "handle_new_auth_user"]]);
  check("all 6 functions installed", fns.length === 6, fns.map((f) => f.proname).join(", "));

  const { rows: anonGrants } = await q(`
    SELECT count(*)::int AS n FROM information_schema.role_table_grants
    WHERE grantee IN ('anon','authenticated') AND table_schema = 'public'`);
  check("anon/authenticated have no table grants", anonGrants[0].n === 0, `${anonGrants[0].n} grants`);

  // ── 2. Fixtures ─────────────────────────────────────────────────────
  console.log("\nFixtures");
  const email = `capacity-test-${Date.now()}@example.test`;
  const { rows: users } = await q(`
    INSERT INTO auth.users (instance_id, id, aud, role, email, created_at, updated_at)
    VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(),
            'authenticated', 'authenticated', $1, now(), now())
    RETURNING id`, [email]);
  const userId = users[0].id;

  const { rows: profiles } = await q(`SELECT id FROM profiles WHERE id = $1`, [userId]);
  check("signup trigger auto-created the profile", profiles.length === 1);

  const { rows: trips } = await q(`
    INSERT INTO trips (id, slug, title, start_date, end_date, total_seats,
                       price_paise, status, created_at, updated_at)
    VALUES (gen_random_uuid(), $1, 'Capacity Test Trip', current_date + 30,
            current_date + 35, $2, 100000, 'PUBLISHED', now(), now())
    RETURNING id`, [`capacity-test-${Date.now()}`, SEATS]);
  const tripId = trips[0].id;
  console.log(`  trip with ${SEATS} seats, ${RACERS} racers each wanting 1 seat`);

  // ── 3. The race ─────────────────────────────────────────────────────
  console.log("\nConcurrency");
  const results = await Promise.allSettled(
    Array.from({ length: RACERS }, () =>
      pool.query(`SELECT reserve_seats($1, $2, 1, 15) AS hold_id`, [tripId, userId])),
  );
  const granted = results.filter((r) => r.status === "fulfilled");
  const refused = results.filter((r) => r.status === "rejected");

  check(`exactly ${SEATS} holds granted`, granted.length === SEATS, `${granted.length} granted`);
  check(`other ${RACERS - SEATS} refused`, refused.length === RACERS - SEATS, `${refused.length} refused`);
  check("refusals cite INSUFFICIENT_SEATS",
    refused.every((r) => (r.reason?.hint ?? r.reason?.message ?? "").includes("INSUFFICIENT_SEATS")),
    refused[0]?.reason?.hint ?? "n/a");

  const { rows: held } = await q(`
    SELECT COALESCE(SUM(seats),0)::int AS n FROM seat_holds
    WHERE trip_id = $1 AND released_at IS NULL AND booking_id IS NULL AND expires_at > now()`, [tripId]);
  check("live holds never exceed capacity", held[0].n <= SEATS, `${held[0].n} of ${SEATS}`);

  // ── 4. Expiry returns the seat ──────────────────────────────────────
  console.log("\nExpiry");
  await q(`UPDATE seat_holds SET expires_at = now() - interval '1 minute' WHERE trip_id = $1`, [tripId]);
  const { rows: reaped } = await q(`SELECT release_expired_holds() AS n`);
  check("reaper released the expired holds", reaped[0].n >= SEATS, `${reaped[0].n} released`);

  const { rows: after } = await q(`SELECT reserve_seats($1, $2, $3, 15) AS hold_id`, [tripId, userId, SEATS]);
  check("seats bookable again after expiry", Boolean(after[0].hold_id));

  // ── 5. Confirm consumes the hold and increments the trip ────────────
  console.log("\nConfirmation");
  const { rows: ref } = await q(`SELECT next_booking_reference() AS r`);
  check("booking reference generated", /^DOT-\d{4}-\d{4}$/.test(ref[0].r), ref[0].r);

  const { rows: bk } = await q(`
    INSERT INTO bookings (id, reference, trip_id, profile_id, seats, unit_price_paise,
                          subtotal_paise, gst_percent, gst_paise, total_paise, created_at, updated_at)
    VALUES (gen_random_uuid(), $1, $2, $3, $4, 100000, 300000, 5, 15000, 315000, now(), now())
    RETURNING id`, [ref[0].r, tripId, userId, SEATS]);

  await q(`SELECT confirm_seat_hold($1, $2)`, [after[0].hold_id, bk[0].id]);
  const { rows: t2 } = await q(`SELECT seats_booked FROM trips WHERE id = $1`, [tripId]);
  check("trip.seats_booked incremented", t2[0].seats_booked === SEATS, `${t2[0].seats_booked}`);

  let reused = false;
  try {
    await q(`SELECT confirm_seat_hold($1, $2)`, [after[0].hold_id, bk[0].id]);
    reused = true;
  } catch { /* expected */ }
  check("a hold cannot be confirmed twice", !reused);

  let oversold = false;
  try {
    await q(`SELECT reserve_seats($1, $2, 1, 15)`, [tripId, userId]);
    oversold = true;
  } catch { /* expected */ }
  check("sold-out trip refuses new holds", !oversold);

  // ── 6. Constraints ──────────────────────────────────────────────────
  console.log("\nConstraints");
  for (const [label, sql] of [
    ["seats_booked cannot exceed total_seats", `UPDATE trips SET seats_booked = 999 WHERE id = '${tripId}'`],
    ["advance cannot exceed price", `UPDATE trips SET advance_paise = 999999 WHERE id = '${tripId}'`],
    ["rating must be 1-5", `INSERT INTO reviews (id, author_name, rating, body, created_at) VALUES (gen_random_uuid(),'x',9,'y',now())`],
  ]) {
    let allowed = false;
    try { await q(sql); allowed = true; } catch { /* expected */ }
    check(label, !allowed);
  }

  // ── Cleanup ─────────────────────────────────────────────────────────
  // bookings -> trips is onDelete: Restrict (deliberately — you must never
  // lose a paid booking by deleting a trip), so tear down in FK order.
  await cleanup();
  console.log("\nfixtures removed");
}

main()
  .then(() => {
    console.log(failures === 0 ? "\n✅ all checks passed\n" : `\n❌ ${failures} check(s) failed\n`);
    return pool.end().then(() => process.exit(failures === 0 ? 0 : 1));
  })
  .catch(async (e) => {
    console.error("\n💥", e.message);
    await pool.end();
    process.exit(1);
  });
