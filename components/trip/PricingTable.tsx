"use client";

import { motion } from "framer-motion";

import { formatINR } from "@/lib/utils";

type Tier = { label: string; description: string | null; price: number };

export function PricingTable({ tiers, gst, tcs = 0 }: { tiers: Tier[]; gst: number; tcs?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ duration: 0.6 }}
      className="overflow-hidden rounded-3xl border border-navy/10 bg-cream"
    >
      <div className="grid grid-cols-1 divide-y divide-navy/10">
        {tiers.map((t, i) => (
          <div
            key={t.label}
            className="grid grid-cols-[1fr_auto] items-center gap-6 px-6 md:px-8 py-5 md:py-6 hover:bg-yellow/10 transition-colors"
            style={i === 0 ? { borderTopWidth: 0 } : undefined}
          >
            <div>
              <h4 className="font-display text-xl md:text-2xl tracking-tight">{t.label}</h4>
              <p className="text-sm text-navy/55 mt-0.5">{t.description}</p>
            </div>
            <div className="text-right">
              <p className="font-display text-2xl md:text-3xl">{formatINR(t.price)}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-navy text-cream/80 px-6 md:px-8 py-4 text-sm flex items-center justify-between">
        <span>All prices in INR. {gst}% GST{tcs > 0 ? ` and ${tcs}% TCS` : ""} applicable on all tiers.</span>
        <span className="hidden sm:inline text-cream/55">Pay via UPI · Cards · Net Banking</span>
      </div>
    </motion.div>
  );
}
