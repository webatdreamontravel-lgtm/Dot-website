"use client";

import Link from "next/link";
import { ArrowRight, Play, MoveDown } from "lucide-react";
import { motion, type Variants } from "framer-motion";
import { GrainOverlay } from "@/components/shared/GrainOverlay";
import { Marquee } from "@/components/shared/Marquee";

const HEADING_LINES = [
  ["Strangers", "to", "Friends."],
  ["Trips", "that", "feel", "like", "home."],
];

const word: Variants = {
  hidden: { y: "120%", opacity: 0 },
  show: (i: number) => ({
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.85,
      delay: 0.15 + i * 0.08,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  }),
};

export function Hero() {
  return (
    <section
      aria-label="Hero"
      className="relative isolate overflow-hidden text-cream min-h-[100svh] flex flex-col"
    >
      <div aria-hidden className="absolute inset-0 mesh-gradient" />
      <GrainOverlay opacity={0.08} />
      {/* subtle vignette */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_120%,rgba(0,0,0,0.55),transparent_60%)]"
      />

      <div className="relative z-10 flex-1 flex flex-col">
        {/* Spacer for nav */}
        <div className="h-24 md:h-28" />

        <div className="mx-auto w-full max-w-7xl px-6 md:px-8 flex-1 flex flex-col justify-center">
          {/* Pill badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="flex justify-center"
          >
            <span className="pill bg-cream/10 text-cream border border-cream/20 backdrop-blur">
              <span className="pulse-dot text-yellow" />
              200+ Travelers · 30+ Trips · One Big Family
            </span>
          </motion.div>

          {/* Heading */}
          <h1
            className="mt-8 md:mt-10 text-center font-display font-medium tracking-tight"
            style={{
              // Floor lowered from 2.75rem: at 375px the clamp pinned the hero to
              // 44px, above even the largest system text style on either mobile
              // platform, and "Strangers to Friends." filled the screen. The vw
              // term and the desktop ceiling are untouched.
              fontSize: "clamp(2.25rem, 8.5vw, 7.25rem)",
              lineHeight: 0.92,
              letterSpacing: "-0.02em",
            }}
          >
            <span className="block">
              {HEADING_LINES[0].map((w, i) => (
                <span
                  key={i}
                  className="inline-block overflow-hidden align-bottom mr-[0.18em]"
                >
                  <motion.span
                    variants={word}
                    initial="hidden"
                    animate="show"
                    custom={i}
                    className="inline-block"
                  >
                    {w === "Friends." ? (
                      <span className="relative inline-block">
                        Friends
                        <UnderlineDoodle />
                        <span>.</span>
                      </span>
                    ) : (
                      w
                    )}
                  </motion.span>
                </span>
              ))}
            </span>
            <span className="block italic text-cream/85" style={{ fontStyle: "italic" }}>
              {HEADING_LINES[1].map((w, i) => (
                <span
                  key={i}
                  className="inline-block overflow-hidden align-bottom mr-[0.18em]"
                >
                  <motion.span
                    variants={word}
                    initial="hidden"
                    animate="show"
                    custom={i + HEADING_LINES[0].length}
                    className="inline-block"
                  >
                    {w}
                  </motion.span>
                </span>
              ))}
            </span>
          </h1>

          {/* Sub */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.9 }}
            className="mt-7 md:mt-8 text-center font-script text-cream/85 text-2xl md:text-3xl"
          >
            A Tamil travel community since 2023.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.05 }}
            className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Link href="#trips" className="btn btn-primary">
              Explore Upcoming Trips
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/about" className="btn btn-ghost">
              <Play className="h-4 w-4" />
              Watch our story
            </Link>
          </motion.div>
        </div>

        {/* Marquee ribbon */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.25 }}
          className="relative pb-10 md:pb-12 pt-6 border-t border-cream/15 mt-8"
        >
          <Marquee
            className="text-cream/70"
            items={[
              "DOT SIGNATURES",
              "MOM & KUTTIES",
              "COASTAL CARNIVALS",
              "MONSOON TRIPS",
              "CULTURAL FEAST",
              "LONG TRIPS",
              "WESTERN GHATS",
              "ABROAD ✈️",
            ]}
          />
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.a
        href="#trips"
        aria-label="Scroll to trips"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, y: [0, 6, 0] }}
        transition={{ delay: 1.4, duration: 1.8, repeat: Infinity }}
        className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 hidden md:flex h-10 w-10 items-center justify-center rounded-full bg-cream/10 backdrop-blur text-cream/80 hover:bg-cream/20"
      >
        <MoveDown className="h-5 w-5" />
      </motion.a>
    </section>
  );
}

function UnderlineDoodle() {
  return (
    <svg
      className="absolute -bottom-3 left-0 w-full"
      viewBox="0 0 300 18"
      fill="none"
      preserveAspectRatio="none"
      aria-hidden
    >
      <motion.path
        d="M3 13 C 60 4, 120 18, 180 8 S 280 6, 297 12"
        stroke="#f4c542"
        strokeWidth="4.5"
        strokeLinecap="round"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, delay: 1.05, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
}
