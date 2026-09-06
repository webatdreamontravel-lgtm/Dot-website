"use client";

import * as Accordion from "@radix-ui/react-accordion";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { RichText } from "@/components/content/RichText";
import type { ItineraryDay } from "@/lib/queries/trips";

export function ItineraryAccordion({ days }: { days: ItineraryDay[] }) {
  return (
    <Accordion.Root
      type="multiple"
      defaultValue={[`day-${days[0]?.dayNumber}`]}
      className="space-y-3"
    >
      {days.map((day, i) => (
        <motion.div
          key={day.dayNumber}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-8%" }}
          transition={{ duration: 0.6, delay: i * 0.08 }}
        >
          <Accordion.Item
            value={`day-${day.dayNumber}`}
            className="rounded-2xl bg-cream border border-navy/10 overflow-hidden data-[state=open]:border-navy/20 data-[state=open]:shadow-sm"
          >
            <Accordion.Header>
              <Accordion.Trigger className="group w-full flex items-start justify-between gap-3 p-4 md:p-7 text-left">
                <div className="flex items-start gap-3 md:gap-6">
                  <div className="flex-shrink-0">
                    <div className="relative h-14 w-14 md:h-16 md:w-16 rounded-2xl bg-navy text-cream flex flex-col items-center justify-center font-display group-data-[state=open]:bg-teal transition-colors">
                      <span className="text-[0.75rem] uppercase tracking-[0.18em] opacity-70">Day</span>
                      <span className="text-2xl leading-none">{day.dayNumber}</span>
                      <span className="absolute inset-0 rounded-2xl ring-2 ring-yellow opacity-0 group-data-[state=open]:opacity-100 group-data-[state=open]:animate-ping" />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.18em] text-navy/55">{day.date}</p>
                    <h3 className="mt-1 font-display text-xl md:text-2xl tracking-tight leading-tight">
                      {day.title}
                    </h3>
                  </div>
                </div>
                <ChevronDown className="h-5 w-5 mt-2 flex-shrink-0 transition-transform duration-300 group-data-[state=open]:rotate-180" />
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="overflow-hidden data-[state=open]:animate-[accordionDown_0.3s_ease-out] data-[state=closed]:animate-[accordionUp_0.3s_ease-out]">
              <div className="px-4 pb-6 md:px-7 md:pb-7 md:pl-[120px] -mt-1">
<RichText doc={day.body} />
                {day.image && (
                  /* Plain <img>: admin-uploaded, no known intrinsic size. */
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={day.image}
                    alt={day.title}
                    loading="lazy"
                    className="mt-4 w-full rounded-2xl object-cover"
                  />
                )}
              </div>
            </Accordion.Content>
          </Accordion.Item>
        </motion.div>
      ))}
      <style jsx global>{`
        @keyframes accordionDown {
          from { height: 0; opacity: 0; }
          to { height: var(--radix-accordion-content-height); opacity: 1; }
        }
        @keyframes accordionUp {
          from { height: var(--radix-accordion-content-height); opacity: 1; }
          to { height: 0; opacity: 0; }
        }
      `}</style>
    </Accordion.Root>
  );
}
