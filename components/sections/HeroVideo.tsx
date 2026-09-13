"use client";

import { useEffect, useRef } from "react";

const SOURCE = "/video/hero-montage.mp4";
const POSTER = "/video/hero-montage-poster.jpg";

/** What `navigator.connection` gives us, on the browsers that have it. */
type NetworkInformation = { saveData?: boolean; effectiveType?: string };

const SLOW = new Set(["slow-2g", "2g", "3g"]);

/**
 * The montage behind the hero.
 *
 * Decorative: aria-hidden, no controls, and no audio track in the file at
 * all. The headline already says what the footage says, and a screen reader
 * announcing a silent twelve-second loop would be pure noise.
 *
 * Three things have to be true before this is worth 29 MB of someone's
 * connection, and none of them can be known on the server:
 *
 *   - they have not asked for reduced motion
 *   - the browser is not reporting Save-Data
 *   - the connection is not 2g/3g
 *
 * So the element ships without a `src` and the client attaches one. When any
 * of the three fails it never gets one, and a <video> with a poster and no
 * source renders the poster — a 240 KB still instead of the loop, no second
 * element, no swap. The poster is frame 0 of that same file, so when the
 * source does arrive the handoff into playback has nothing to cross-fade.
 *
 * The src is set on the node rather than through state on purpose: it is a
 * one-way write to a DOM property that React does not need to know about,
 * and routing it through a re-render would only re-run the whole hero.
 *
 * The mesh gradient underneath is the last resort — a decode failure or a
 * 404 leaves this on the background the hero has always had rather than on
 * a black rectangle.
 */
export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const link = (navigator as Navigator & { connection?: NetworkInformation }).connection;
    if (link?.saveData) return;
    if (link?.effectiveType && SLOW.has(link.effectiveType)) return;

    video.src = SOURCE;
    // The autoplay attribute is evaluated against a source that was not
    // there at mount, so ask directly too. The rejection is the expected
    // answer on iOS in Low Power Mode, which refuses even muted inline
    // video; the poster stays up and nothing else has to change.
    video.play().catch(() => {});
  }, []);

  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      <video
        ref={ref}
        className="h-full w-full object-cover"
        poster={POSTER}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />
    </div>
  );
}
