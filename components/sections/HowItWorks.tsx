import { BadgeIndianRupee, CalendarCheck, MapPinned, Users } from "lucide-react";

import { siteConfig } from "@/lib/data/siteConfig";

/**
 * The plain-English explanation of what this business sells and how paying
 * for it works.
 *
 * The hero above says "Strangers to Friends" — which is the brand, not an
 * answer to "what am I buying and what happens after I pay". That answer
 * belongs on the landing page in as few words as possible: for someone
 * deciding whether to trust us with ₹80,000, and for a payment gateway's
 * review team, who are asking exactly the same question with less patience.
 *
 * Server-rendered on purpose. It's the section most likely to be read on a
 * slow connection, so it costs no JavaScript.
 */

const STEPS = [
  {
    icon: MapPinned,
    title: "Pick a departure",
    body: "Every trip is a fixed, dated batch with a published itinerary, a seat count and a price per person.",
  },
  {
    icon: BadgeIndianRupee,
    title: "Reserve with an advance",
    body: "Pay the advance shown on the trip page to hold your seat. Prices are in ₹, with GST shown separately before you pay.",
  },
  {
    icon: CalendarCheck,
    title: "Settle the balance",
    body: "The rest is due before departure — we tell you the date when you book, and remind you well ahead of it.",
  },
  {
    icon: Users,
    title: "Travel with the group",
    body: "You get the full itinerary, a packing list and a trip lead who travels with you from the first pickup to the last drop.",
  },
];


export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="relative overflow-hidden bg-navy py-24 text-cream md:py-32"
    >
      <div className="grain opacity-[0.05]" aria-hidden />

      <div className="relative mx-auto max-w-7xl px-6 md:px-8">
        <div className="max-w-2xl">
          <p className="font-script text-2xl text-yellow">How it works</p>
          <h2
            id="how-it-works-heading"
            className="mt-2 font-display text-3xl tracking-tight md:text-6xl"
            style={{ lineHeight: 1.02 }}
          >
            Booking a seat, <span className="italic text-yellow">start to finish</span>
          </h2>
          <p className="mt-5 text-[1.02rem] leading-relaxed text-cream/70">
            {siteConfig.name} is a tour operator based in {siteConfig.address.city}. We design and run
            small-group trips across India and abroad — you book a seat on a specific departure, and we
            handle the stays, the transport, the plan and the people.
          </p>
        </div>

        <ol className="mt-14 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-cream/[0.08] ring-1 ring-cream/15">
                  <step.icon className="h-[1.15rem] w-[1.15rem] text-yellow" aria-hidden />
                </span>
                <span
                  aria-hidden
                  className="font-display text-3xl leading-none text-cream/15"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="mt-4 font-display text-xl tracking-tight md:text-[1.4rem]">
                {step.title}
              </h3>
              <p className="mt-2 text-[0.93rem] leading-relaxed text-cream/65">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
