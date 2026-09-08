"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

/**
 * Keeps this trip's bookings table current while someone watches it.
 *
 * The screen is open on a laptop while people are booking, and without this
 * the only way to see a new booking is to press refresh — which means the
 * number on screen is only ever as fresh as the last time someone thought to
 * check it.
 *
 * ── What actually goes over the wire ──
 *
 * A count and the latest `updated_at`, on the interval below. Not the rows:
 * fetching the table each time would be a page load each time, for a screen
 * that changes a few times an hour. When the signature moves, and only then,
 * router.refresh() re-runs the server component and the real rows arrive —
 * so the expensive part happens on the ticks that matter and never otherwise.
 *
 * ── Why it stops ──
 *
 * Hidden tabs don't poll. An admin tab lives open all day behind other
 * windows, and a repeated request from a tab nobody is looking at is pure
 * cost. It resyncs the moment the tab comes back, so nothing is missed by
 * having paused.
 *
 * Failures back off rather than hammering, so a server that is down or a
 * session that has expired stops costing a request per interval.
 */
/** How often the open screen asks whether anything changed. */
const POLL_MS = 30_000;

/**
 * Ceiling for the error backoff.
 *
 * Five minutes rather than the poll interval: once the server is down or the
 * session has expired, retrying at the normal rate is just the same failure
 * on a loop. It recovers instantly anyway — the tab coming back to the
 * foreground checks straight away regardless of where the backoff had got to.
 */
const MAX_BACKOFF_MS = 300_000;

export function LiveBookings({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);

  // The signature this page was rendered from. A ref, not state: changing it
  // must not itself cause a render, or the poll and the render chase
  // each other.
  const seen = useRef<string | null>(null);
  const failures = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (cancelled) return;

      // Backed off while hidden rather than stopped, so the loop is still
      // alive to notice the tab coming back.
      if (document.visibilityState !== "visible") {
        timer = setTimeout(tick, POLL_MS);
        return;
      }

      let waitMs = POLL_MS;
      try {
        const res = await fetch(`/api/admin/trips/${tripId}/bookings/pulse`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(String(res.status));

        const { count, latest } = (await res.json()) as {
          count: number;
          latest: string | null;
        };
        const signature = `${count}:${latest ?? ""}`;
        failures.current = 0;

        if (seen.current === null) {
          // First answer is the baseline, not a change — the page was just
          // rendered from this same data.
          seen.current = signature;
        } else if (seen.current !== signature) {
          seen.current = signature;
          if (!cancelled) {
            setUpdating(true);
            router.refresh();
            // The indicator is time-based because router.refresh() gives no
            // completion signal; this is long enough to be read, short
            // enough not to linger over a table that is already current.
            setTimeout(() => !cancelled && setUpdating(false), 1200);
          }
        }
      } catch {
        // 60s, 120s, 240s… to the ceiling. An expired session or a stopped
        // server stops costing a request every half minute within a few tries.
        failures.current += 1;
        waitMs = Math.min(POLL_MS * 2 ** failures.current, MAX_BACKOFF_MS);
      }

      if (!cancelled) timer = setTimeout(tick, waitMs);
    };

    // Check straight away when the tab is brought back, rather than waiting
    // out whatever remains of the current interval.
    const onVisible = () => {
      if (document.visibilityState === "visible" && !cancelled) {
        if (timer) clearTimeout(timer);
        void tick();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    timer = setTimeout(tick, POLL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [tripId, router]);

  return (
    <span
      // Announced rather than only shown: the table changing under someone
      // with no explanation is worse than a moment's notice that it is about
      // to.
      role="status"
      aria-live="polite"
      className={
        "inline-flex items-center gap-1.5 text-[0.8rem] transition-opacity duration-200 " +
        (updating ? "text-teal opacity-100" : "pointer-events-none opacity-0")
      }
    >
      <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />
      New activity — updating
    </span>
  );
}
