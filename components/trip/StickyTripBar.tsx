"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { TripDetailView } from "@/lib/queries/trips";
import { formatINR, taxSuffix } from "@/lib/utils";

export function StickyTripBar({ trip }: { trip: TripDetailView }) {
  const [show, setShow] = useState(false);
  const minPrice = trip.fromPrice;

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isSoldOut = trip.availability === "SOLD_OUT";

  return (
    <>
      {/* Desktop sticky bar */}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ y: -64, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -64, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="hidden md:flex fixed top-0 inset-x-0 z-40 bg-cream/90 backdrop-blur border-b border-navy/10"
          >
            <div className="mx-auto max-w-7xl w-full px-8 py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.18em] text-navy/55">{trip.category ?? "Trip"}</p>
                <h2 className="font-display text-2xl truncate">{trip.title}</h2>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.18em] text-navy/55">From</p>
                  <p className="font-medium">{formatINR(minPrice)} <span className="text-sm text-navy/55">{taxSuffix(trip.gstPercent, trip.tcsPercent)}</span></p>
                </div>
                {isSoldOut ? (
                  <span className="btn bg-navy/15 text-navy/50">Sold Out</span>
                ) : (
                  /* Straight to checkout. It used to be href="#book", which
                     scrolled to the bottom of the page and asked for the same
                     click again. */
                  <Link href={`/trips/${trip.slug}/book`} className="btn btn-primary">
                    Book Now
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile sticky bottom bar */}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-cream border-t border-navy/10 px-4 py-3 flex items-center gap-3 shadow-[0_-12px_32px_-12px_rgba(15,30,61,0.2)]"
          >
            <div className="flex-1">
              <p className="text-[0.75rem] uppercase tracking-[0.18em] text-navy/55">From</p>
              <p className="font-display text-xl leading-tight">{formatINR(minPrice)}</p>
            </div>
            {isSoldOut ? (
              <span className="btn bg-navy/15 text-navy/50 flex-1 justify-center">Sold Out</span>
            ) : (
              <Link
                href={`/trips/${trip.slug}/book`}
                className="btn btn-primary flex-1 justify-center"
              >
                Book Now
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
