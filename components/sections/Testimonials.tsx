"use client";

import { motion } from "framer-motion";
import { Quote } from "lucide-react";
import type { ReviewView } from "@/lib/queries/reviews";
import { AnimatedHeading } from "@/components/shared/AnimatedHeading";
import { Stars } from "@/components/shared/Stars";
import { cn } from "@/lib/utils";

export function Testimonials({ reviews }: { reviews: ReviewView[] }) {
  if (reviews.length === 0) return null;

  return (
    <section
      aria-label="Testimonials"
      className="relative bg-cream-soft text-navy py-24 md:py-32 overflow-hidden"
    >
      <div className="grain opacity-[0.05]" aria-hidden />
      <div className="mx-auto max-w-7xl px-6 md:px-8">
        <div className="max-w-3xl">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="font-script text-2xl text-teal"
          >
            Stories from the road
          </motion.p>
          <AnimatedHeading className="mt-2 text-4xl md:text-7xl">
            What our travelers <span className="italic text-coral">say</span>
          </AnimatedHeading>
        </div>

        {/* Narrows with the count. A fixed three-column grid holding one or
            two reviews reads as a section that failed to load the rest. */}
        <div
          className={cn(
            "mt-14 grid gap-5 md:mt-20 md:gap-6",
            reviews.length === 1 && "max-w-xl",
            reviews.length === 2 && "max-w-4xl sm:grid-cols-2",
            reviews.length >= 3 && "md:grid-cols-3",
          )}
        >
          {reviews.map((t, i) => (
            <motion.figure
              key={t.id}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ duration: 0.7, delay: i * 0.1 }}
              className="relative rounded-3xl bg-cream p-7 md:p-9 border border-navy/8 shadow-sm flex flex-col"
            >
              <Quote className="h-8 w-8 text-yellow mb-5" />
              <blockquote className="font-display text-xl md:text-2xl tracking-tight leading-snug flex-1">
                &ldquo;{t.body}&rdquo;
              </blockquote>
              {/* No portraits. The rating carries the weight the photo used
                  to, and it's a claim we can actually stand behind. */}
              <figcaption className="mt-7 border-t border-navy/8 pt-5">
                <Stars rating={t.rating} className="mb-2" />
                <p className="font-medium leading-tight">{t.authorName}</p>
                <p className="text-sm text-navy/55">{t.tripTitle}</p>
                {t.isVerified && (
                  <p className="mt-1 text-[0.75rem] font-semibold uppercase tracking-wider text-teal">
                    ✓ Verified traveller
                  </p>
                )}
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
