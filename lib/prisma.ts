import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/lib/generated/prisma/client";

// Prisma 7 removed `datasourceUrl` from the client constructor — connecting
// now requires a driver adapter (or Prisma Accelerate). The connection
// string lives here rather than in schema.prisma, which only declares the
// provider.
//
// This is the POOLED url (Supabase transaction pooler, port 6543). The
// direct url on 5432 is used only by the CLI for migrations; see
// prisma.config.ts. Don't swap them — serverless invocations will exhaust
// the direct connection limit under any real traffic.
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.",
  );
}

// Pool sizing is the thing that actually breaks under load. node-postgres
// defaults to max: 10 PER CLIENT INSTANCE — and serverless creates a new
// instance per concurrent invocation. Fifty warm lambdas would try to open
// 500 connections against a pooler that allows a fraction of that.
//
// In serverless each invocation handles one request at a time, so a pool
// larger than a couple of connections is pure waste. Locally we want a few
// more so the dev server and scripts aren't serialised.
const isServerless = Boolean(process.env.VERCEL || process.env.NETLIFY);

const createPrismaClient = () =>
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      max: isServerless ? 2 : 10,
      // Don't let an invocation hang waiting for a connection that isn't
      // coming — fail fast so the request can return a real error.
      connectionTimeoutMillis: 10_000,
      // Release connections back to the pooler quickly; holding them idle
      // starves other instances.
      idleTimeoutMillis: 10_000,
      allowExitOnIdle: isServerless,
    }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

// The Next dev server hot-reloads modules on every save, which would open a
// fresh pool each time until Postgres starts refusing connections.
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
