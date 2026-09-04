import { NextResponse } from "next/server";

/**
 * Liveness probe for the deploy pipeline.
 *
 * deploy/remote-deploy.sh polls this after flipping the `current` symlink and
 * reloading PM2. A non-200 within the timeout rolls the release back, so this
 * must answer only the question "did THIS build boot with usable config?" —
 * nothing else. In particular it does NOT touch the database: a Supabase blip
 * during a deploy would otherwise roll back a perfectly good release, and the
 * rollback target would fail the same check anyway.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  // Set by the workflow's BUILD job so you can confirm which commit is live
  // without SSHing in: curl -s https://<site>/api/health
  //
  // NEXT_PUBLIC_* is inlined by the bundler at build time, which is exactly
  // what's wanted here — the value is welded to the artifact and identifies
  // the build itself. Changing it in the runtime .env has no effect.
  const release = process.env.NEXT_PUBLIC_RELEASE_SHA ?? "unknown";

  // A missing DATABASE_URL means PM2 started the process without the .env —
  // the app would 500 on the first page that queries. Catch it here instead.
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { status: "unhealthy", release, reason: "DATABASE_URL is not set" },
      { status: 503 },
    );
  }

  return NextResponse.json(
    { status: "ok", release, uptime: Math.round(process.uptime()) },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
