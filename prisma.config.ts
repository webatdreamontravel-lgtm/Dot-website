import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js reads .env.local; plain `dotenv/config` only reads .env. Without
// this, the Prisma CLI can't see the credentials you put in .env.local and
// every migrate command fails with an unhelpful "undefined url".
// Loaded first so it wins — dotenv never overwrites an already-set var.
loadEnv({ path: ".env.local" });
loadEnv();

// Prisma 7 note: `directUrl` no longer exists on the datasource config
// (the type is `{ url, shadowDatabaseUrl }`). The CLI — migrate, db push,
// introspect — uses the url below, and those commands need a DIRECT
// connection to Supabase on port 5432. The pooler on 6543 is a transaction
// pooler; it can't run migrations or hold the advisory lock they need.
//
// So: CLI gets DIRECT_URL here, the app runtime gets DATABASE_URL (pooled)
// via the driver adapter in lib/prisma.ts. Don't collapse these into one.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
