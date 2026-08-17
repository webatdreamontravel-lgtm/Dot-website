/**
 * Imports the Turkey trip from sites.google.com/view/turkey12026.
 *
 *   npx tsx --env-file=.env.local scripts/import-turkey.ts
 *
 * Created as a DRAFT so the team can review it in the admin and preview the
 * page before anything goes public. Re-running updates the same trip.
 */
import { PrismaPg } from "@prisma/adapter-pg";

import { Prisma, PrismaClient } from "../lib/generated/prisma/client.js";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

type Node = Record<string, unknown>;
const t = (text: string): Node => ({ type: "text", text });
const p = (text: string): Node => ({ type: "paragraph", content: [t(text)] });
const h = (text: string, level = 3): Node => ({ type: "heading", attrs: { level }, content: [t(text)] });
const ul = (items: string[]): Node => ({
  type: "bulletList",
  content: items.map((i) => ({ type: "listItem", content: [p(i)] })),
});
const doc = (content: Node[]): Node => ({ type: "doc", content });
const json = (v: unknown) => v as Prisma.InputJsonValue;

const ITINERARY: [string, string, string][] = [
  ["Arrive at Istanbul", "26 Sep",
   "Common pickup from Istanbul airport at 3:00 PM, then check in and freshen up. Evening Bosphorus dinner cruise with Turkish food and cultural performances — traditional music, folk dances, belly dance and dervish performances — sailing back past the illuminated Istanbul skyline."],
  ["Exploring Istanbul's history", "27 Sep",
   "A hearty Turkish breakfast, then the Blue Mosque, Topkapi Palace Museum and Gülhane Park. Lunch with regional specialities before the Egyptian Bazaar — the Spice Market — where you'll come back to the hotel carrying treasures."],
  ["Modern Istanbul", "28 Sep",
   "The Grand Bazaar and its 4,000+ shops, Taksim Square, and a walk down Istiklal Street with the red tram. Climb Galata Tower for the panorama, stop for Sebastian cake and döner kebab, then transfer to the airport for the flight to Cappadocia."],
  ["Off to Cappadocia", "29 Sep",
   "Land in Cappadocia and head to Love Valley, then the Goreme Open Air Museum. Check into a traditional cave hotel, walk Red Valley Park at sunset, and finish with dinner at the cave hotel — local Cappadocian cooking and regional wines."],
  ["Cappadocia, in the air", "30 Sep",
   "A pre-dawn hot air balloon ride with 100+ balloons rising around you, and a celebratory toast when you land. Then the underground city's labyrinth, a climb up Uchisar Castle — the highest point in Cappadocia — a walk through Pigeon Valley, sunset at Goreme and a themed dinner."],
  ["Antalya, here we come", "1 Oct",
   "One more morning at Love Valley, then fly to Antalya and check into a luxury resort. Lara Beach and the Mediterranean in the afternoon, pool time, and an evening stroll along the waterfront to find dinner."],
  ["Exploring Antalya", "2 Oct",
   "Düden Waterfalls, where the water plunges into thick greenery. Hadrian's Gate, a Roman archway still standing after nearly 2,000 years. Then Kaleiçi Old Town — narrow cobblestone streets, Ottoman-era houses, cafés and boutiques — and an evening out."],
  ["A day at Pamukkale", "3 Oct",
   "A scenic road trip from Antalya, watching the landscape change. The ancient city of Hierapolis and its museum, then into the travertine pools and their warm mineral-rich water. Photograph the white terraces glowing in the afternoon sun, take an optional swim in Cleopatra's Pool among the ancient columns, and fly back to Istanbul in the evening."],
  ["Until next time", "4 Oct",
   "Time at Istanbul airport to sit with it all, then the flight home — carrying sunsets over valleys, ancient ruins and bustling bazaars."],
];

async function main() {
  const trip = await prisma.trip.upsert({
    where: { slug: "turkey-community-trip-2026" },
    update: { tcsPercent: 2 },
    create: {
      slug: "turkey-community-trip-2026",
      title: "Turkey Community Trip",
      batchName: "Turkey 2026 · Batch 1",
      tagline: "Istanbul, Cappadocia, Antalya & Pamukkale — nine days across two continents",
      destination: "Turkey",
      category: "Abroad",

      startDate: new Date("2026-09-26"),
      endDate: new Date("2026-10-04"),
      durationLabel: "9 Days, 8 Nights",
      startingFrom: "Istanbul",
      ageGroup: "18 - 39 years",

      totalSeats: 18,
      seatsBooked: 0,
      minParticipants: 9,

      // Early-bird is the live price; the standard price is the strike-through.
      pricePaise: 17299900,
      comparePricePaise: 21999900,
      offerLabel: "Early bird",
      advancePaise: 1999900,
      gstPercent: 5,
      // The page states 2%. Worth confirming against the current slab for
      // overseas tour packages before this takes live payments.
      tcsPercent: 2,
      instalmentCount: 0,

      razorpayEnabled: false,
      autoCloseWhenFull: true,
      showSeatsLeft: true,
      isFeatured: false,
      // Draft on purpose — review it before it goes public.
      status: "DRAFT",

      introduction: json(doc([
        p("Istanbul where East meets West, the fairy chimneys of Cappadocia, the Mediterranean at Antalya, and the white travertine terraces of Pamukkale — nine days across two continents with eighteen people who start as strangers."),
        p("Byzantine and Ottoman heritage in the morning, a hot air balloon at dawn, thermal pools among Roman ruins. Turkey does not do things by halves."),
      ])),

      itinerary: json(ITINERARY.map(([title, date, body], i) => ({
        dayNumber: i + 1,
        dayLabel: `DAY ${i + 1}`,
        date,
        title,
        body: doc([p(body)]),
        image: null,
      }))),

      inclusions: json(doc([
        h("Stays", 4),
        ul([
          "Istanbul — 2 nights in a 5-star hotel",
          "Cappadocia — 1 night in a premium cave hotel (4-star) and 1 night in a 5-star stay",
          "Antalya — 2 nights at a 5-star resort",
        ]),
        h("Travel", 4),
        ul([
          "Airport transfers as per the itinerary",
          "Private luxury bus for all transfers and sightseeing",
          "Tram ticket fees",
        ]),
        h("Food & experiences", 4),
        ul([
          "8 meals — 7 breakfasts and 1 dinner",
          "Luxury Bosphorus cruise with dinner and Turkish cultural performances",
          "Entry fees to all major attractions (worth around ₹38,000)",
          "All city tours as per the itinerary",
          "Local guides at heritage sites",
          "Trip lead with the group throughout",
          "Private WhatsApp group and a virtual pre-trip meeting",
          "DOT surprise elements along the way",
        ]),
      ])),

      exclusions: json(doc([
        ul([
          "Visa fees",
          "International flights to and from Istanbul",
          "Domestic flights — Istanbul to Cappadocia, Cappadocia to Antalya, Pamukkale to Istanbul (3 flights). DOT helps you book these; fares move with the booking date",
          "Hot air balloon ride",
          "Meals not listed in the inclusions",
          "Hammam and massage services",
          "Basic travel insurance",
          "Gratuities for guides, drivers and porters",
          "Laundry, phone charges, shopping and shows",
          "Optional or individual activities outside the itinerary",
          "Public transport beyond what the package covers",
          "Costs arising from weather, flight cancellations or changes in government regulations",
          "Loss, theft or misplacement of personal belongings",
        ]),
      ])),

      thingsToKnow: json(doc([
        h("Who can join"),
        p("Ages 18 to 39. DOT is a Tamil strangers-to-friends travel community, founded by Priya and Santhosh, with travellers joining from across South India. Solo travellers and groups are equally welcome."),
        h("Money to carry"),
        p("Budget roughly ₹40,000–45,000 for lunches, dinners and shopping. A forex card works widely, but carrying some cash is essential. We'll guide you on forex and currency exchange once you've booked."),
        h("Staying connected"),
        p("Turkish SIM cards are available on arrival if you want one, and WiFi is easy to find. International roaming on your Indian SIM works too. Your trip lead carries a Turkish number so you can always reach them."),
        h("Where you'll stay"),
        p("Every stay was handpicked for comfort, vibe and authenticity — views worth photographing and hosts who make you feel welcome."),
        h("Your Trip Captain"),
        p("Vibe manager, guide, storyteller and concierge in one. They handle the logistics, the local insight and the group's energy so you can just be on holiday."),
        h("The DOT extras"),
        p("DOT Evenings built around a good sunset, gratitude sessions, small gifts and a few surprises we won't spoil here."),
        h("How booking works"),
        p("Pay the ₹19,999 advance to secure your slot, fill in the booking form, and you'll get a confirmation by email. The private WhatsApp group opens 10 days before departure and there's a virtual meet 15 days prior. Slots are first-come, first-served."),
        h("A note on conduct"),
        p("Travellers are responsible for their own belongings; the management isn't accountable for missing items. Weather and road conditions can force changes, and the itinerary may be adjusted in the interest of safety, comfort and general well-being. No act of misconduct or indiscipline will be tolerated — this is a cordial travel community."),
      ])),

      cancellationPolicy: json(doc([
        h("If you cancel", 4),
        p("The ₹19,999 advance is non-refundable."),
        ul([
          "70–46 days before departure — 75% refund, 25% cancellation fee",
          "45–29 days before departure — 55% refund, 45% cancellation fee",
          "30–0 days before departure — no refund, as all arrangements are pre-paid",
        ]),
        p("This is a peak-season international trip, so rescheduling and transfers to other trips are not available. No-shows are not refunded, and unused inclusions aren't refundable."),
        h("If we cancel", 4),
        p("This trip needs a minimum of 9 travellers. If we don't reach that, we'll move it to another date, offer you an alternate trip with free rescheduling, or convert the amount into a DreamOnTravel coupon valid for 3 months. Refunds are full, less any train or bus cancellation charges already incurred."),
        p("In the case of natural calamities or other circumstances outside anyone's control: before departure, we shift the date or issue a coupon valid 3 months. After departure, arrangements are already paid for 10 days ahead, so no refund is possible."),
      ])),
    },
    select: { id: true, slug: true, title: true },
  });

  await prisma.tripPricingTier.deleteMany({ where: { tripId: trip.id } });
  await prisma.tripPricingTier.createMany({
    data: [
      { tripId: trip.id, label: "Early bird", description: "+ 5% GST and 2% TCS per person", pricePaise: 17299900, sortOrder: 0 },
      { tripId: trip.id, label: "Standard", description: "+ 5% GST and 2% TCS per person", pricePaise: 21999900, sortOrder: 1 },
    ],
  });

  console.log(`\n  ✅ ${trip.title}`);
  console.log(`  /admin/trips  →  slug: ${trip.slug}`);
  console.log(`  Saved as a DRAFT — preview it, then publish when you're happy.\n`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("\n💥", e);
    await prisma.$disconnect();
    process.exit(1);
  });
