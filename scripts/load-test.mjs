/**
 * Simulates a trip launch: N people hitting "Book" on the SAME trip at the
 * same moment. This is the worst case for the system — every request
 * contends for one row lock.
 *
 *   npm run db:load-test              # 1000 requests, 50 seats, pool of 20
 *   CONCURRENCY=2000 npm run db:load-test
 *
 * Passing means: exactly `SEATS` holds granted, everyone else cleanly
 * refused, and zero connection-level errors.
 */
import pg from "pg";

const CONCURRENCY = Number(process.env.CONCURRENCY ?? 1000);
const SEATS = Number(process.env.SEATS ?? 50);
const POOL_MAX = Number(process.env.POOL ?? 40);
const SLUG = `loadtest-${Date.now()}`;

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: POOL_MAX,
  connectionTimeoutMillis: 20_000,
  idleTimeoutMillis: 10_000,
  ssl: { rejectUnauthorized: false },
});

const pct = (arr, p) => arr.length ? arr.sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor(arr.length * p))] : 0;

async function main() {
  console.log(`\n  ${CONCURRENCY} simultaneous booking attempts`);
  console.log(`  ${SEATS} seats available · client pool of ${POOL_MAX} connections\n`);

  // Fixtures: a handful of users, cycled across the requests.
  const { rows: users } = await pool.query(`
    INSERT INTO auth.users (instance_id, id, aud, role, email, created_at, updated_at)
    SELECT '00000000-0000-0000-0000-000000000000', gen_random_uuid(),
           'authenticated', 'authenticated', '${SLUG}-' || g || '@example.test', now(), now()
    FROM generate_series(1, 20) g
    RETURNING id`);
  const userIds = users.map((u) => u.id);

  const { rows: trips } = await pool.query(`
    INSERT INTO trips (id, slug, title, start_date, end_date, total_seats,
                       price_paise, status, created_at, updated_at)
    VALUES (gen_random_uuid(), $1, 'Load Test', current_date + 30, current_date + 35,
            $2, 2899900, 'PUBLISHED', now(), now())
    RETURNING id`, [SLUG, SEATS]);
  const tripId = trips[0].id;

  // ── The stampede ────────────────────────────────────────────────────
  const started = Date.now();
  const latencies = [];
  const results = await Promise.allSettled(
    Array.from({ length: CONCURRENCY }, (_, i) => {
      const t0 = Date.now();
      return pool
        .query(`SELECT reserve_seats($1, $2, 1, 15)`, [tripId, userIds[i % userIds.length]])
        .then((r) => { latencies.push(Date.now() - t0); return r; })
        .catch((e) => { latencies.push(Date.now() - t0); throw e; });
    }),
  );
  const elapsed = Date.now() - started;

  const granted = results.filter((r) => r.status === "fulfilled").length;
  const errors = results.filter((r) => r.status === "rejected").map((r) => r.reason);

  const bucket = (e) => {
    const m = `${e?.hint ?? ""} ${e?.message ?? ""}`;
    if (m.includes("INSUFFICIENT_SEATS")) return "refused: sold out (correct)";
    if (m.includes("lock timeout") || e?.code === "55P03") return "lock wait timeout";
    if (m.includes("timeout exceeded when trying to connect")) return "pool exhausted (client)";
    if (m.includes("ECONNRESET") || m.includes("ETIMEDOUT")) return "connection dropped";
    if (m.includes("too many clients") || m.includes("max_client_conn")) return "SERVER CONNECTION LIMIT";
    if (m.includes("statement timeout") || e?.code === "57014") return "statement timeout";
    return `other: ${(e?.message ?? "").slice(0, 60)}`;
  };
  const tally = {};
  for (const e of errors) tally[bucket(e)] = (tally[bucket(e)] ?? 0) + 1;

  // ── Verify ──────────────────────────────────────────────────────────
  const { rows: held } = await pool.query(`
    SELECT COALESCE(SUM(seats),0)::int AS n FROM seat_holds
    WHERE trip_id = $1 AND released_at IS NULL AND booking_id IS NULL AND expires_at > now()`, [tripId]);
  const { rows: avail } = await pool.query(`SELECT trip_seats_available($1) AS n`, [tripId]);

  console.log("  Outcome");
  console.log(`    granted          ${granted}`);
  for (const [k, v] of Object.entries(tally)) console.log(`    ${k.padEnd(28)} ${v}`);

  console.log("\n  Throughput");
  console.log(`    wall clock       ${(elapsed / 1000).toFixed(2)}s`);
  console.log(`    requests/sec     ${Math.round(CONCURRENCY / (elapsed / 1000))}`);
  console.log(`    latency p50      ${pct(latencies, 0.5)}ms`);
  console.log(`    latency p95      ${pct(latencies, 0.95)}ms`);
  console.log(`    latency p99      ${pct(latencies, 0.99)}ms`);
  console.log(`    slowest          ${Math.max(...latencies)}ms`);

  const connectionFailures =
    (tally["pool exhausted (client)"] ?? 0) +
    (tally["connection dropped"] ?? 0) +
    (tally["SERVER CONNECTION LIMIT"] ?? 0);

  console.log("\n  Verdict");
  const checks = [
    [`exactly ${SEATS} seats granted, not one more`, granted === SEATS, `${granted}`],
    ["live holds match capacity", held[0].n === SEATS, `${held[0].n}`],
    ["availability reads 0", avail[0].n === 0, `${avail[0].n}`],
    ["no server connection-limit errors", (tally["SERVER CONNECTION LIMIT"] ?? 0) === 0],
    ["no dropped connections", (tally["connection dropped"] ?? 0) === 0],
    ["every rejection was a clean 'sold out'", errors.length === (tally["refused: sold out (correct)"] ?? 0)],
  ];
  let bad = 0;
  for (const [label, ok, detail] of checks) {
    console.log(`    ${ok ? "ok  " : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
    if (!ok) bad++;
  }

  // ── Read path under the same load ───────────────────────────────────
  const rStart = Date.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, () =>
    pool.query(`SELECT trip_seats_available($1)`, [tripId]).catch(() => null)));
  const rElapsed = Date.now() - rStart;
  console.log(`\n  Read path (what the trip cards call)`);
  console.log(`    ${CONCURRENCY} availability reads in ${(rElapsed / 1000).toFixed(2)}s ` +
              `(${Math.round(CONCURRENCY / (rElapsed / 1000))}/sec, lock-free)`);

  // ── Cleanup ─────────────────────────────────────────────────────────
  await pool.query(`DELETE FROM seat_holds WHERE trip_id = $1`, [tripId]);
  await pool.query(`DELETE FROM trips WHERE id = $1`, [tripId]);
  await pool.query(`DELETE FROM auth.users WHERE email LIKE $1`, [`${SLUG}-%`]);

  console.log(bad === 0 && connectionFailures === 0
    ? "\n✅ held up — no oversell, no connection failures\n"
    : `\n❌ ${bad} check(s) failed, ${connectionFailures} connection failure(s)\n`);
  return bad === 0 && connectionFailures === 0;
}

main()
  .then(async (ok) => { await pool.end(); process.exit(ok ? 0 : 1); })
  .catch(async (e) => { console.error("\n💥", e.message); await pool.end(); process.exit(1); });
