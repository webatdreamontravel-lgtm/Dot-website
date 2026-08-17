"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { motion, useMotionValue, useSpring } from "framer-motion";

function subscribe() {
  return () => {};
}

function getEnabled() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(pointer: fine)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Routes where the custom cursor is off — admin and auth are tools, and a
 *  lagging decorative cursor makes precise form work irritating. */
const BARE_ROUTES = ["/admin", "/login", "/account"];

export function CursorFollower() {
  const pathname = usePathname();
  const bare = BARE_ROUTES.some((r) => pathname?.startsWith(r));
  const enabled = useSyncExternalStore(subscribe, getEnabled, () => false) && !bare;
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const sx = useSpring(x, { stiffness: 200, damping: 28, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 200, damping: 28, mass: 0.6 });
  const [hovering, setHovering] = useState(false);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const onMove = (e: MouseEvent) => {
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => {
        x.set(e.clientX);
        y.set(e.clientY);
        const target = e.target as HTMLElement | null;
        const isHover = !!target?.closest("a, button, [data-cursor-hover]");
        setHovering(isHover);
      });
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [enabled, x, y]);

  if (!enabled) return null;

  return (
    <motion.div
      aria-hidden
      style={{ translateX: sx, translateY: sy }}
      className="pointer-events-none fixed left-0 top-0 z-[100] hidden md:block"
    >
      <motion.div
        animate={{
          width: hovering ? 56 : 18,
          height: hovering ? 56 : 18,
          opacity: hovering ? 0.2 : 0.55,
        }}
        transition={{ type: "spring", stiffness: 220, damping: 22 }}
        className="-translate-x-1/2 -translate-y-1/2 rounded-full bg-teal mix-blend-difference"
      />
    </motion.div>
  );
}
