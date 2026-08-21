/**
 * Seeds three short domestic trips — Walayar, Thekkady, Wayanad.
 *
 *   npx tsx --env-file=.env.local scripts/seed-local-trips.ts
 *
 * These exist to give the public site a clean, self-explanatory product
 * range: three dated departures from Coimbatore between ₹2,499 and ₹13,999,
 * all domestic, all priced the same way (fare + 5% GST, no TCS), and none of
 * them asking for money the site cannot yet take.
 *
 * advancePaise is deliberately null on all three. Until a gateway is live
 * there is no way to collect an advance online, and quoting one on the page
 * is a promise the checkout can't keep. Booking records the request and the
 * team follows up to arrange payment.
 *
 * Re-running updates the same three trips rather than creating duplicates,
 * so it is safe to run repeatedly while the copy is being tuned.
 */
import { PrismaPg } from "@prisma/adapter-pg";

import { Prisma, PrismaClient } from "../lib/generated/prisma/client.js";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

type Node = Record<string, unknown>;
const t = (text: string): Node => ({ type: "text", text });
const p = (text: string): Node => ({ type: "paragraph", content: [t(text)] });
const h = (text: string, level = 4): Node => ({ type: "heading", attrs: { level }, content: [t(text)] });
const ul = (items: string[]): Node => ({
  type: "bulletList",
  content: items.map((i) => ({ type: "listItem", content: [p(i)] })),
});
const doc = (content: Node[]): Node => ({ type: "doc", content });
const json = (v: unknown) => v as Prisma.InputJsonValue;

const img = (id: string, w: number) => `https://images.unsplash.com/${id}?w=${w}&q=80`;

/** The same schedule as /cancellation-and-refund-policy, restated per trip. */
const CANCELLATION = doc([
  p("Cancellations are calculated from the date your written request reaches us, against the trip's start date."),
  ul([
    "30 days or more before the trip — 90% refund",
    "15 to 29 days before the trip — 50% refund",
    "7 to 14 days before the trip — 25% refund",
    "Less than 7 days before the trip — no refund",
  ]),
  p("If we cancel the trip — including when a departure doesn't reach its minimum group size — you get a full refund, or a credit voucher worth 110% of what you paid, valid for 12 months. Approved refunds reach the original payment method within 7 business days."),
]);

type Day = { title: string; date: string; body: string };

type Seed = {
  slug: string;
  title: string;
  batchName: string;
  tagline: string;
  destination: string;
  category: string;
  startDate: string;
  endDate: string;
  durationLabel: string;
  ageGroup: string;
  totalSeats: number;
  minParticipants: number;
  pricePaise: number;
  heroImage: string;
  cardImage: string;
  isFeatured: boolean;
  intro: string[];
  itinerary: Day[];
  inclusions: Node[];
  exclusions: string[];
  thingsToKnow: Node[];
  moodboard: { label: string; value: number }[];
};

const TRIPS: Seed[] = [
  {
    slug: "walayar-forest-day-out-2026",
    title: "Walayar Forest Day Out",
    batchName: "Walayar 2026 · Batch 1",
    tagline: "One day, one van, and the Western Ghats forty minutes from home",
    destination: "Walayar, Palakkad",
    category: "Western Ghats",
    startDate: "2026-09-20",
    endDate: "2026-09-20",
    durationLabel: "1 Day",
    ageGroup: "18 - 45 years",
    totalSeats: 20,
    minParticipants: 8,
    pricePaise: 249900,
    heroImage: img("photo-1470071459604-3b5ec3a7fe05", 1920),
    cardImage: img("photo-1544735716-392fe2489ffa", 1200),
    isFeatured: false,
    intro: [
      "The easiest way to meet the group. Out of Coimbatore before sunrise, into the Walayar reserve by breakfast, and home the same night with a phone full of photos and twenty new numbers.",
      "No leave to apply for, no packing to agonise over. If you have been meaning to try a DOT trip and never found the weekend for it, this is the one.",
    ],
    itinerary: [
      { title: "Coimbatore → Walayar", date: "20 Sep", body: "Pickup at 6:00 AM from Gandhipuram, second stop at Ukkadam. Breakfast on the way at a roadside kadai — the kind with three items on the menu and all of them good. Into the reserve forest by 8:30 AM." },
      { title: "The forest and the falls", date: "20 Sep", body: "A guided walk with a local naturalist through teak and bamboo, watching for langur, giant squirrel and — if the morning is kind — a herd crossing at distance. Late morning at the falls, feet in the water, nobody in a hurry." },
      { title: "Lunch, dam and back", date: "20 Sep", body: "A proper Kerala sadhya-style lunch, then an hour at the Walayar dam catchment as the light goes gold. Back on the road by 5:30 PM and into Coimbatore around 7:30 PM." },
    ],
    inclusions: [
      h("Travel"),
      ul(["AC Traveller from Coimbatore and back", "All tolls, parking and driver batta"]),
      h("Food"),
      ul(["Breakfast and lunch", "Evening tea and snacks"]),
      h("Experiences"),
      ul([
        "Guided forest walk with a licensed naturalist",
        "Forest department entry permits",
        "A DOT trip lead with the group all day",
        "Private WhatsApp group before and after",
      ]),
    ],
    exclusions: [
      "Travel from your city to the Coimbatore pickup point",
      "Personal expenses and shopping",
      "Anything not listed under inclusions",
    ],
    thingsToKnow: [
      ul([
        "It is a single long day — 6:00 AM start, roughly 7:30 PM return.",
        "The forest walk is about 4 km on flat ground. Closed shoes, not sandals.",
        "Carry a government photo ID. The forest checkpost asks for it.",
        "Phone signal drops inside the reserve for about two hours. Tell people at home in advance.",
        "No alcohol on this trip — it is a protected reserve and the permit is conditional on it.",
      ]),
    ],
    moodboard: [
      { label: "Leisure", value: 3 },
      { label: "City & Culture", value: 1 },
      { label: "Nature", value: 5 },
      { label: "Adventure", value: 2 },
      { label: "History & Heritage", value: 1 },
      { label: "Physical Effort", value: 2 },
    ],
  },
  {
    slug: "thekkady-spice-trail-2026",
    title: "Thekkady Spice Trail",
    batchName: "Thekkady 2026 · Batch 1",
    tagline: "Two days of cardamom hills, Periyar lake and a bamboo raft at dawn",
    destination: "Thekkady, Idukki",
    category: "DOT Signatures",
    startDate: "2026-10-10",
    endDate: "2026-10-11",
    durationLabel: "2 Days, 1 Night",
    ageGroup: "18 - 45 years",
    totalSeats: 18,
    minParticipants: 8,
    pricePaise: 899900,
    heroImage: img("photo-1518002171953-a080ee817e1f", 1920),
    cardImage: img("photo-1502784444187-359ac186c5bb", 1200),
    isFeatured: true,
    intro: [
      "Thekkady smells like the inside of a spice tin. Cardamom, pepper and clove growing on the slopes you are walking through, and a tiger reserve on the other side of the lake.",
      "One night, two full days, and a Saturday-morning bamboo raft on Periyar that most people who live an hour away have never done.",
    ],
    itinerary: [
      { title: "Coimbatore → Thekkady | Spice walk | Kalari", date: "10 Oct", body: "Leave Coimbatore at 5:30 AM, breakfast at Munnar road, and into Thekkady by early afternoon. Check in, then a guided walk through a working cardamom and pepper plantation with the family who farm it. Evening Kalaripayattu performance, dinner at the stay." },
      { title: "Bamboo raft on Periyar | Back home", date: "11 Oct", body: "Up at 5:30 AM for the bamboo rafting slot on Periyar lake with a forest naturalist — three hours on the water when the mist is still sitting on it, which is when the animals come down to drink. Late breakfast, spice market, and on the road by 2:00 PM. Coimbatore by 9:00 PM." },
    ],
    inclusions: [
      h("Stay"),
      ul(["1 night in a Thekkady property on triple-sharing basis", "Hot water and Wi-Fi at the stay"]),
      h("Travel"),
      ul(["AC Traveller from Coimbatore and back", "All tolls, parking, permits and driver batta"]),
      h("Food"),
      ul(["2 breakfasts, 1 lunch, 1 dinner", "Tea and snacks through both days"]),
      h("Experiences"),
      ul([
        "Guided spice plantation walk",
        "Bamboo rafting on Periyar lake with a forest naturalist",
        "Kalaripayattu performance",
        "A DOT trip lead with the group throughout",
      ]),
    ],
    exclusions: [
      "Travel from your city to the Coimbatore pickup point",
      "Meals not listed in the inclusions",
      "Personal expenses, shopping and optional activities",
      "Anything not listed under inclusions",
    ],
    thingsToKnow: [
      ul([
        "Rafting slots are allotted by the forest department and are capped. We book them the day the batch confirms.",
        "Carry a government photo ID — it is required for both the reserve entry and the stay.",
        "Triple sharing is the default. Twin or single can be arranged at extra cost, tell us when you book.",
        "October evenings in Thekkady are genuinely cold. One warm layer.",
        "Leeches are a real thing on the plantation walk in the weeks after rain. We carry salt and it is fine.",
      ]),
    ],
    moodboard: [
      { label: "Leisure", value: 3 },
      { label: "City & Culture", value: 3 },
      { label: "Nature", value: 5 },
      { label: "Adventure", value: 3 },
      { label: "History & Heritage", value: 2 },
      { label: "Physical Effort", value: 2 },
    ],
  },
  {
    slug: "wayanad-misty-trails-2026",
    title: "Wayanad Misty Trails",
    batchName: "Wayanad 2026 · Batch 1",
    tagline: "Three days of Edakkal caves, Chembra tea slopes and a bonfire that runs late",
    destination: "Wayanad, Kerala",
    category: "Long Trips",
    startDate: "2026-11-14",
    endDate: "2026-11-16",
    durationLabel: "3 Days, 2 Nights",
    ageGroup: "18 - 40 years",
    totalSeats: 16,
    minParticipants: 9,
    pricePaise: 1399900,
    heroImage: img("photo-1590050752117-238cb0fb12b1", 1920),
    cardImage: img("photo-1605649487212-47bdab064df7", 1200),
    isFeatured: false,
    intro: [
      "Wayanad in November, after the rain has finished and before the crowds work it out. Tea slopes that disappear into cloud by four in the afternoon, petroglyphs carved into a cave wall six thousand years ago, and two nights of the group not wanting to go to bed.",
      "This is the long one of the three — enough time that by the second evening nobody is introducing themselves any more.",
    ],
    itinerary: [
      { title: "Coimbatore → Wayanad | Edakkal Caves", date: "14 Nov", body: "Pickup at 5:00 AM, breakfast en route, and up through the Thamarassery ghat with its nine hairpins. Check in by noon. Afternoon at the Edakkal caves — a proper climb up to Neolithic carvings and a view down over the whole district. Evening bonfire and dinner at the stay." },
      { title: "Chembra & Soochipara", date: "15 Nov", body: "Early start for the Chembra Peak trail up to the heart-shaped lake — the best three hours of the trip and the hardest. Down for a late lunch, then Soochipara falls in the afternoon with time to actually get in the water. Evening free in Kalpetta town." },
      { title: "Banasura, then home", date: "16 Nov", body: "A slow morning, then Banasura Sagar — the largest earth dam in India — and a speedboat across the reservoir. Lunch, last coffee, and on the road by 2:30 PM. Coimbatore by 9:30 PM." },
    ],
    inclusions: [
      h("Stay"),
      ul(["2 nights in a Wayanad resort on triple-sharing basis", "Hot water, Wi-Fi and a bonfire on night one"]),
      h("Travel"),
      ul(["AC Traveller from Coimbatore and back", "All tolls, parking, permits and driver batta"]),
      h("Food"),
      ul(["3 breakfasts, 2 lunches, 2 dinners", "Tea and snacks through all three days"]),
      h("Experiences"),
      ul([
        "Edakkal Caves entry and guide",
        "Chembra Peak trek permit and forest guide",
        "Soochipara falls entry",
        "Banasura Sagar speedboat ride",
        "A DOT trip lead with the group throughout",
      ]),
    ],
    exclusions: [
      "Travel from your city to the Coimbatore pickup point",
      "Meals not listed in the inclusions",
      "Personal expenses, shopping and optional activities",
      "Travel insurance",
      "Anything not listed under inclusions",
    ],
    thingsToKnow: [
      ul([
        "Chembra is a real trek — roughly 3 hours up and down, steep in places, no shade for most of it. Skip it and spend the morning at the resort if you would rather; nobody will mind.",
        "Trekking shoes, not sneakers. This is the one piece of kit worth borrowing if you don't own it.",
        "The Chembra permit count is fixed by the forest department and released on the day. If it closes, we swap in Meenmutty falls.",
        "November nights in Wayanad drop to around 15°C. Bring a jacket.",
        "Triple sharing is the default. Twin or single can be arranged at extra cost, tell us when you book.",
      ]),
    ],
    moodboard: [
      { label: "Leisure", value: 3 },
      { label: "City & Culture", value: 2 },
      { label: "Nature", value: 5 },
      { label: "Adventure", value: 4 },
      { label: "History & Heritage", value: 3 },
      { label: "Physical Effort", value: 4 },
    ],
  },
];

async function main() {
  for (const s of TRIPS) {
    const content = {
      title: s.title,
      batchName: s.batchName,
      tagline: s.tagline,
      destination: s.destination,
      category: s.category,

      startDate: new Date(s.startDate),
      endDate: new Date(s.endDate),
      durationLabel: s.durationLabel,
      startingFrom: "Coimbatore",
      ageGroup: s.ageGroup,

      heroImage: s.heroImage,
      cardImage: s.cardImage,

      totalSeats: s.totalSeats,
      minParticipants: s.minParticipants,

      pricePaise: s.pricePaise,
      gstPercent: 5,
      // Domestic. TCS applies to overseas packages only.
      tcsPercent: 0,
      // No advance: nothing on this site can take a payment yet, so quoting
      // one would be a number we can't honour at checkout.
      advancePaise: null,
      instalmentCount: 0,

      razorpayEnabled: false,
      autoCloseWhenFull: true,
      showSeatsLeft: true,
      isFeatured: s.isFeatured,
      status: "PUBLISHED" as const,
      publishedAt: new Date(),

      introduction: json(doc(s.intro.map(p))),
      itinerary: json(
        s.itinerary.map((d, i) => ({
          dayNumber: i + 1,
          dayLabel: `DAY ${i + 1}`,
          date: d.date,
          title: d.title,
          body: doc([p(d.body)]),
          image: null,
        })),
      ),
      inclusions: json(doc(s.inclusions)),
      exclusions: json(doc([ul(s.exclusions)])),
      thingsToKnow: json(doc(s.thingsToKnow)),
      moodboard: json(s.moodboard),
      cancellationPolicy: json(CANCELLATION),
    };

    const trip = await prisma.trip.upsert({
      where: { slug: s.slug },
      // seatsBooked is left alone on update — it is owned by reserve_seats()
      // and clobbering it here would desync the oversell guard.
      update: content,
      create: { slug: s.slug, seatsBooked: 0, ...content },
      select: { id: true, slug: true, pricePaise: true, totalSeats: true, seatsBooked: true },
    });

    const gross = Math.round(trip.pricePaise * 1.05);
    console.log(
      `✓ ${trip.slug.padEnd(32)} ₹${(trip.pricePaise / 100).toLocaleString("en-IN")}` +
        ` + 5% GST = ₹${(gross / 100).toLocaleString("en-IN")}` +
        `  · ${trip.seatsBooked}/${trip.totalSeats} seats booked`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
