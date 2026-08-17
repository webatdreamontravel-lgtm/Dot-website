-- ═══════════════════════════════════════════════════════════════════════
-- Stop the losing requests from stampeding the row lock.
--
-- Measured before this change: 1000 simultaneous attempts on a 50-seat
-- trip took 20s wall clock, 50 req/s, p50 latency 13.6s, and 271 requests
-- timed out waiting for a connection. Seat accounting was perfect — but a
-- quarter of the customers saw a spinner then an error.
--
-- The waste: after the 50th seat goes, the remaining 950 requests each
-- still queue for FOR UPDATE on the trip row just to be told "sold out".
-- They serialise behind every earlier request for no reason.
--
-- Fix: a lock-free pre-check. It is deliberately racy — it can say
-- "available" when the seat is gone a microsecond later — which is fine,
-- because the authoritative check still happens under the lock below.
-- It can never wrongly grant a seat, only wrongly decline one during a
-- burst, and the customer can retry.
-- ═══════════════════════════════════════════════════════════════════════

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
  SET LOCAL lock_timeout = '5s';
  SET LOCAL statement_timeout = '10s';

  IF p_seats < 1 THEN
    RAISE EXCEPTION 'seats must be at least 1' USING ERRCODE = '22023';
  END IF;

  -- ── Fast path: no lock taken ──
  -- Cheap dirty read. Bails out the hopeless majority instantly instead of
  -- making them wait their turn for a lock only to be refused.
  SELECT "status" INTO v_status FROM "trips"
   WHERE "id" = p_trip_id AND "deleted_at" IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'trip not found' USING ERRCODE = 'P0002', HINT = 'TRIP_NOT_FOUND';
  END IF;

  IF v_status <> 'PUBLISHED' THEN
    RAISE EXCEPTION 'trip is not open for booking' USING ERRCODE = 'P0001', HINT = 'TRIP_NOT_PUBLISHED';
  END IF;

  IF public.trip_seats_available(p_trip_id) < p_seats THEN
    RAISE EXCEPTION 'no seats available'
      USING ERRCODE = 'P0001', HINT = 'INSUFFICIENT_SEATS';
  END IF;

  -- ── Authoritative path: serialised, and the only thing that can grant ──
  SELECT "total_seats", "seats_booked", "status"
    INTO v_total, v_booked, v_status
  FROM "trips"
  WHERE "id" = p_trip_id AND "deleted_at" IS NULL
  FOR UPDATE;

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

-- Makes the pre-check's aggregate over live holds an index-only scan.
CREATE INDEX IF NOT EXISTS seat_holds_available_idx
  ON "seat_holds" ("trip_id", "expires_at")
  INCLUDE ("seats")
  WHERE "released_at" IS NULL AND "booking_id" IS NULL;
