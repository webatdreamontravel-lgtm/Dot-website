-- Fixed-window rate limit counters. See model RateLimit in schema.prisma.
CREATE TABLE "rate_limit" (
    "bucket"       TEXT        NOT NULL,
    "identifier"   TEXT        NOT NULL,
    "window_start" TIMESTAMPTZ(3) NOT NULL,
    "count"        INTEGER     NOT NULL DEFAULT 0,

    CONSTRAINT "rate_limit_pkey" PRIMARY KEY ("bucket", "identifier", "window_start")
);

-- Supports the cleanup sweep, which deletes by window age.
CREATE INDEX "rate_limit_window_start_idx" ON "rate_limit" ("window_start");
