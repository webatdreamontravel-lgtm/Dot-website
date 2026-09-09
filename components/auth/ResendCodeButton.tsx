"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Submit button for "send me another code", disabled until a cooldown expires.
 *
 * Rendered on screens that were reached *because* a code was just sent, so the
 * countdown starts immediately on mount rather than after the first click —
 * otherwise the first resend is free and the limit means nothing.
 *
 * This is a UI guard, not a rate limit. It stops the honest double-tap and the
 * "nothing arrived yet" reflex, which is what actually burns send quota. It
 * does not stop anyone scripting the endpoint; Supabase's own per-address
 * limits are what cover that.
 */
export function ResendCodeButton({
  seconds = 30,
  pending,
  idleLabel = "send a new code",
  pendingLabel = "sending…",
  className,
}: {
  /** Cooldown length. Restarts each time the button is used. */
  seconds?: number;
  /** The form action's pending state, from useActionState. */
  pending: boolean;
  idleLabel?: string;
  pendingLabel?: string;
  className?: string;
}) {
  // Deadline lives in a ref and is set in an effect, never during render:
  // calling Date.now() while rendering would differ between the server and
  // client passes and produce a hydration mismatch.
  const deadline = useRef<number>(0);
  const [remaining, setRemaining] = useState(seconds);

  const tick = useCallback(() => {
    setRemaining(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)));
  }, []);

  const restart = useCallback(() => {
    deadline.current = Date.now() + seconds * 1000;
    tick();
  }, [seconds, tick]);

  useEffect(() => {
    restart();
    // Driven off wall-clock rather than by decrementing a counter, so a
    // backgrounded tab (where timers are throttled) still shows the right
    // number when it comes back instead of a countdown frozen mid-way.
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [restart, tick]);

  /**
   * Restart the cooldown when a send FINISHES, never from onClick.
   *
   * Restarting in the click handler made `waiting` true, which made the button
   * disabled — and React flushes state from discrete events synchronously,
   * before the browser performs the button's default action. A disabled button
   * has no activation behaviour, so the form submission was dropped and the
   * whole thing silently did nothing but reset its own timer.
   *
   * Watching `pending` fall keeps the same guarantee the old comment claimed:
   * the cooldown applies whether the send succeeded or failed, because the
   * flag falls either way. In-flight, `pending` is what disables the button.
   */
  const wasPending = useRef(false);
  useEffect(() => {
    if (pending) {
      wasPending.current = true;
      return;
    }
    if (wasPending.current) {
      wasPending.current = false;
      restart();
    }
  }, [pending, restart]);

  const waiting = remaining > 0;

  return (
    <button
      type="submit"
      disabled={waiting || pending}
      aria-live="polite"
      className={className}
    >
      {pending ? pendingLabel : waiting ? `send a new code in ${remaining}s` : idleLabel}
    </button>
  );
}
