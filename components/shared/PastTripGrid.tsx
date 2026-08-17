"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { pastTrips } from "@/lib/data/pastTrips";
import { cn } from "@/lib/utils";

const SIZE_CLASSES: Record<string, string> = {
  sm: "md:col-span-3 md:row-span-1 aspect-[4/3]",
  md: "md:col-span-3 md:row-span-2 aspect-[4/5]",
  lg: "md:col-span-4 md:row-span-2 aspect-[4/5]",
  xl: "md:col-span-6 md:row-span-2 aspect-[16/10]",
};

export function PastTripGrid() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-12 md:auto-rows-[140px] gap-3 md:gap-4">
      {pastTrips.map((t, i) => (
        <motion.figure
          key={t.id}
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-8%" }}
          transition={{ duration: 0.6, delay: i * 0.04 }}
          whileHover={{ y: -4 }}
          className={cn(
            "group relative overflow-hidden rounded-2xl bg-navy",
            SIZE_CLASSES[t.size ?? "md"],
            "col-span-2",
          )}
          data-cursor-hover
        >
          <Image
            src={t.image}
            alt={t.name}
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover transition-transform duration-700 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-navy/85 via-navy/10 to-transparent" />
          <figcaption className="absolute inset-x-0 bottom-0 p-5 md:p-6 text-cream translate-y-1 group-hover:translate-y-0 transition-transform">
            <p className="text-xs uppercase tracking-[0.18em] text-cream/65 mb-1">
              {t.date} · {t.location}
            </p>
            <h3 className="font-display text-2xl md:text-3xl leading-tight">{t.name}</h3>
            <p className="mt-2 text-sm text-cream/70">{t.travelers} travelers · DOT crew</p>
          </figcaption>
        </motion.figure>
      ))}
    </div>
  );
}
