/**
 * Verifies every connection path the app depends on — including the ones
 * that pass on a laptop and then fail once deployed.
 *
 *   npm run db:check
 *
 * The load-bearing check is IPv4. `db.<ref>.supabase.co` resolves to IPv6
 * only; Vercel and Netlify functions have no IPv6. Connecting from a dev
 * machine proves nothing about production, so we resolve explicitly.
 */
import dns from "node:dns/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { PrismaClient } from "../lib/generated/prisma/client.js";

const REF = "pmyhczojxiepwqnktvav";
const PASSWORD = "JikkEjGNDP9zyqcW";

let failures = 0;
const check = (label: string, pass: boolean, detail = "") => {
  console.log(`  ${pass ? "ok  " : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!pass) failures++;
};

/** dns.lookup uses the OS resolver; dns.resolve4 talks to DNS servers
 *  directly and can be blocked, reporting a false "no IPv4". */
async function addressFamilies(host: string) {
  try {
    const all = await dns.lookup(host, { all: true });
    return {
      v4: all.filter((a) => a.family === 4).map((a) => a.address),
      v6: all.filter((a) => a.family === 6).map((a) => a.address),
    };
  } catch {
    return { v4: [], v6: [] };
  }
}

async function canConnect(connectionString: string) {
  const client = new pg.Client({
    connectionString,
    connectionTimeoutMillis: 10_000,
    ssl: { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    await client.query("select 1");
    await client.end();
    return { ok: true, error: "" };
  } catch (e) {
    try { await client.end(); } catch { /* already down */ }
    return { ok: false, error: (e as Error).message.slice(0, 70) };
  }
}

async function main() {
  console.log("\nHost reachability\n");

  const hosts = [
    { label: "db.<ref>.supabase.co  (direct)", host: `db.${REF}.supabase.co` },
    { label: "aws-0-ap-south-1.pooler       ", host: "aws-0-ap-south-1.pooler.supabase.com" },
  ];

  for (const h of hosts) {
    const { v4, v6 } = await addressFamilies(h.host);
    console.log(
      `  ${h.label}  IPv4:${v4.length ? v4[0] : "NONE"}  IPv6:${v6.length ? "yes" : "no"}`,
    );
  }

  const poolerV4 = (await addressFamilies("aws-0-ap-south-1.pooler.supabase.com")).v4;
  const directV4 = (await addressFamilies(`db.${REF}.supabase.co`)).v4;
  check("pooler is reachable over IPv4 (required to deploy)", poolerV4.length > 0);
  check("direct host is IPv6-only, so we correctly avoid it", directV4.length === 0);

  console.log("\nCredentials against each port\n");

  const urls = {
    "transaction pooler :6543": `postgresql://postgres.${REF}:${PASSWORD}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`,
    "session pooler     :5432": `postgresql://postgres.${REF}:${PASSWORD}@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`,
  };
  for (const [label, url] of Object.entries(urls)) {
    const r = await canConnect(url);
    check(label, r.ok, r.error);
  }

  // pgbouncer=true is a legacy flag for Prisma's old Rust engine. With the
  // pg driver adapter it can be passed through as an unknown startup
  // parameter, so confirm it doesn't break the connection either way.
  const withFlag = await canConnect(`${urls["transaction pooler :6543"]}?pgbouncer=true`);
  check("connection string tolerates ?pgbouncer=true", withFlag.ok, withFlag.error);

  console.log("\nEnvironment wiring\n");
  check("DATABASE_URL points at the pooler", (process.env.DATABASE_URL ?? "").includes("pooler.supabase.com"));
  check("DATABASE_URL uses transaction mode 6543", (process.env.DATABASE_URL ?? "").includes(":6543"));
  check("DIRECT_URL uses session mode 5432", (process.env.DIRECT_URL ?? "").includes(":5432"));
  check("no env var still references the IPv6-only direct host",
    ![process.env.DATABASE_URL, process.env.DIRECT_URL].some((u) => (u ?? "").includes(`db.${REF}`)));

  console.log("\nPrisma client through @prisma/adapter-pg\n");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  try {
    const trips = await prisma.trip.count();
    check("connects and queries", true, `${trips} trips`);

    // Transaction pooling is where naive prepared-statement reuse blows up
    // with "prepared statement s0 already exists". A burst of identical
    // queries is the cheapest way to smoke that out.
    const burst = await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        prisma.trip.findMany({ where: { status: "PUBLISHED" }, take: 1, skip: i % 4 }),
      ),
    );
    check("25 concurrent queries, no prepared-statement clash", burst.length === 25);

    await prisma.$transaction(async (tx) => {
      await tx.siteSetting.upsert({
        where: { key: "__connection_test" },
        create: { key: "__connection_test", value: { ok: true } },
        update: { value: { ok: true } },
      });
    });
    check("interactive transaction commits through the pooler", true);
    await prisma.siteSetting.delete({ where: { key: "__connection_test" } });

    const [{ s }] = await prisma.$queryRaw<{ s: string }[]>`select 'PUBLISHED'::"TripStatus" as s`;
    check("enum round-trips", s === "PUBLISHED", s);

    // `SHOW timezone` returns a column literally named "TimeZone" and can't
    // be aliased; current_setting() can.
    const [{ tz }] = await prisma.$queryRaw<{ tz: string }[]>`select current_setting('TimeZone') as tz`;
    check("server timezone is UTC (hold expiry depends on it)", tz === "UTC", tz);

    // Serial reconnects approximate cold serverless invocations.
    for (let i = 0; i < 3; i++) {
      const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
      await p.trip.count();
      await p.$disconnect();
    }
    check("repeated cold connects succeed (serverless pattern)", true);
  } catch (e) {
    check("prisma client", false, (e as Error).message.slice(0, 160));
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    console.log(failures === 0 ? "\n✅ all connection checks passed\n" : `\n❌ ${failures} check(s) failed\n`);
    process.exit(failures === 0 ? 0 : 1);
  })
  .catch((e) => {
    console.error("\n💥", e);
    process.exit(1);
  });
