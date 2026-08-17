-- ═══════════════════════════════════════════════════════════════════════
-- Concurrency hardening for launch-day traffic spikes.
--
-- reserve_seats() takes FOR UPDATE on the trip row, which is exactly what
-- prevents overselling — but it also means every concurrent booking for a
-- trip queues behind that lock. With the defaults this database ships with
-- (lock_timeout = 0, idle_in_transaction_session_timeout = 0), one stuck
-- transaction holds the lock indefinitely and every other booking for that
-- trip waits forever. On a trip launch that is a total outage of the thing
-- you most need working.
-- ═══════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────
-- 1. Never let a transaction sit idle holding locks
--
-- 30s is far longer than any legitimate booking transaction (they are all
-- sub-100ms) and short enough that a wedged client self-heals.
-- ───────────────────────────────────────────────────────────────────────

ALTER DATABASE postgres SET idle_in_transaction_session_timeout = '30s';

-- A runaway query can't monopolise a connection for the default 2 minutes.
ALTER DATABASE postgres SET statement_timeout = '30s';


-- ───────────────────────────────────────────────────────────────────────
-- 2. Fail fast instead of queueing forever
--
-- SET LOCAL scopes these to the function's transaction only, so migrations
-- and admin queries keep their generous limits.
--
-- 5s lock wait: under a burst, waiting a few seconds for the row lock is
-- normal and fine. Waiting 30s means something is wrong and the customer
-- deserves an error they can retry rather than a spinner.
-- ───────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.reserve_seats(
  p_trip_id      uuid,
  p_profile_id   uuid,
  p_seats        int,
  p_hold_minutes int DEFAULT 15
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_total      int;
  v_booked     int;
  v_held       int;
  v_available  int;
  v_status     "TripStatus";
  v_hold_id    uuid;
BEGIN
  -- Bounded waits. Without these a single wedged session stalls every
  -- booking for this trip indefinitely.
  SET LOCAL lock_timeout = '5s';
  SET LOCAL statement_timeout = '10s';

  IF p_seats < 1 THEN
    RAISE EXCEPTION 'seats must be at least 1' USING ERRCODE = '22023';
  END IF;

  SELECT "total_seats", "seats_booked", "status"
    INTO v_total, v_booked, v_status
  FROM "trips"
  WHERE "id" = p_trip_id AND "deleted_at" IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'trip not found' USING ERRCODE = 'P0002', HINT = 'TRIP_NOT_FOUND';
  END IF;

  IF v_status <> 'PUBLISHED' THEN
    RAISE EXCEPTION 'trip is not open for booking' USING ERRCODE = 'P0001', HINT = 'TRIP_NOT_PUBLISHED';
  END IF;

  SELECT COALESCE(SUM("seats"), 0) INTO v_held
  FROM "seat_holds"
  WHERE "trip_id" = p_trip_id
    AND "released_at" IS NULL
    AND "booking_id" IS NULL
    AND "expires_at" > now();

  v_available := v_total - v_booked - v_held;

  IF p_seats > v_available THEN
    RAISE EXCEPTION 'only % seat(s) available', GREATEST(v_available, 0)
      USING ERRCODE = 'P0001', HINT = 'INSUFFICIENT_SEATS';
  END IF;

  INSERT INTO "seat_holds" ("id", "trip_id", "profile_id", "seats", "expires_at", "created_at")
  VALUES (gen_random_uuid(), p_trip_id, p_profile_id, p_seats,
          now() + make_interval(mins => p_hold_minutes), now())
  RETURNING "id" INTO v_hold_id;

  RETURN v_hold_id;
END;
$$;


CREATE OR REPLACE FUNCTION public.confirm_seat_hold(
  p_hold_id    uuid,
  p_booking_id uuid
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_trip_id uuid;
  v_seats   int;
  v_expired boolean;
  v_total   int;
  v_booked  int;
BEGIN
  SET LOCAL lock_timeout = '5s';
  SET LOCAL statement_timeout = '10s';

  SELECT "trip_id", "seats", ("expires_at" <= now())
    INTO v_trip_id, v_seats, v_expired
  FROM "seat_holds"
  WHERE "id" = p_hold_id
    AND "released_at" IS NULL
    AND "booking_id" IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'hold not found or already consumed'
      USING ERRCODE = 'P0002', HINT = 'HOLD_UNAVAILABLE';
  END IF;

  SELECT "total_seats", "seats_booked" INTO v_total, v_booked
  FROM "trips" WHERE "id" = v_trip_id FOR UPDATE;

  IF v_expired AND (v_booked + v_seats) > v_total THEN
    RAISE EXCEPTION 'hold expired and trip is now full'
      USING ERRCODE = 'P0001', HINT = 'HOLD_EXPIRED_TRIP_FULL';
  END IF;

  IF (v_booked + v_seats) > v_total THEN
    RAISE EXCEPTION 'trip is full' USING ERRCODE = 'P0001', HINT = 'INSUFFICIENT_SEATS';
  END IF;

  UPDATE "trips"
     SET "seats_booked" = "seats_booked" + v_seats,
         "updated_at"   = now()
   WHERE "id" = v_trip_id;

  UPDATE "seat_holds"
     SET "booking_id" = p_booking_id
   WHERE "id" = p_hold_id;
END;
$$;


-- ───────────────────────────────────────────────────────────────────────
-- 3. Availability without taking a lock
--
-- The trip cards and listing page must never queue behind a booking's row
-- lock just to render "5 seats left". This reads the same numbers with no
-- locking at all — slightly stale by design, which is correct for display.
-- Authoritative capacity is only ever decided inside reserve_seats().
-- ───────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trip_seats_available(p_trip_id uuid)
RETURNS int
LANGUAGE sql
STABLE
AS $$
  SELECT GREATEST(
    t."total_seats" - t."seats_booked" - COALESCE((
      SELECT SUM(h."seats") FROM "seat_holds" h
      WHERE h."trip_id" = t."id"
        AND h."released_at" IS NULL
        AND h."booking_id" IS NULL
        AND h."expires_at" > now()
    ), 0), 0)::int
  FROM "trips" t WHERE t."id" = p_trip_id;
$$;
