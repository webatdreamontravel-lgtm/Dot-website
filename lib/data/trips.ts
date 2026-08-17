export type TripStatus = "FAST_FILLING" | "FEW_SLOTS_LEFT" | "SOLD_OUT" | "OPEN";

export type ItineraryDay = {
  dayNumber: number;
  dayLabel: string;
  date: string;
  title: string;
  description: string;
};

export type PricingTier = {
  label: string;
  price: number;
  description: string;
};

export type Trip = {
  slug: string;
  title: string;
  tagline: string;
  destination: string;
  category: string;
  heroImage: string;
  thumbnailImage: string;
  duration: string;
  startDate: string;
  endDate: string;
  startingFrom: string;
  ageGroup: string;
  totalSlots: number;
  bookedSlots: number;
  status: TripStatus;
  isFeatured: boolean;
  introduction: string;
  whyTravelWithUs: string[];
  whoCanJoin: string;
  itineraryDays: ItineraryDay[];
  inclusions: string[];
  exclusions: string[];
  thingsToKnow: {
    basicInfo: string;
    fromOtherLocations: string;
    money: string;
    howToBook: string;
  };
  pricingTiers: PricingTier[];
  advanceAmount: number;
  gstPercentage: number;
  cancellationPolicy: string;
};

export const trips: Trip[] = [
  {
    slug: "mom-and-kutties-munnar-may-2026",
    title: "Mom & Kutties Getaway",
    tagline: "Mother's Day Special Summer Escape to Munnar",
    destination: "Munnar",
    category: "DOT Signatures",
    heroImage:
      "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=1920&q=80",
    thumbnailImage:
      "https://images.unsplash.com/photo-1591018653425-2531c50f4554?w=1200&q=80",
    duration: "2 Days, 1 Night",
    startDate: "2026-05-09",
    endDate: "2026-05-10",
    startingFrom: "Coimbatore",
    ageGroup: "Kids 3-12 years",
    totalSlots: 7,
    bookedSlots: 4,
    status: "FAST_FILLING",
    isFeatured: true,
    introduction: `Eena Meena Teeka, Munnar polama style ah🎉

Welcome to the summer escape to Munnar, the scenic hills that offers the perfect sun relief, exploring gardens, playing with the elephants and the calm, cinematic nature! Taking your kids along with you on a trip is the happiest escape you could ever have! Meet moms like you, let loose and let your kids play around, this is going to be a super fun, relaxing getaway...

So vaanga, Munnar ku polaam💫`,
    whyTravelWithUs: [
      "All our trips are personally experienced by our team and carefully handcrafted itineraries with unique experiences.",
      "We do an exploratory visit before announcing every trip — for a pleasant and hustle-free experience.",
      "All our accommodations are in premium properties, personally experienced by the team.",
      "Experienced trip leads with well-equipped experience who'll take care of your well-being throughout.",
    ],
    whoCanJoin:
      "Travelers from any part of India can join the trip. DOT is a TAMIL based travel community. Age category for kids: 3-12 years.",
    itineraryDays: [
      {
        dayNumber: 0,
        dayLabel: "DAY 0",
        date: "May 08 - Friday",
        title: "Travelling from Chennai / Bangalore | Fun time with travellers",
        description: `We start our train or bus journey from Chennai at night with the other co-travelers.

Reach Coimbatore around 5:30 AM - 6:00 AM on May 08 (Friday).

Our team will pick you from the railway station or bus stand itself, no worries.

The group assembles at the pick-up point and later meets the co-travellers from other places in Coimbatore.`,
      },
      {
        dayNumber: 1,
        dayLabel: "DAY 1",
        date: "May 09 - Saturday",
        title: "Coimbatore → Munnar | Western Ghats Drive | Pool Time",
        description: `Starting time: 6:30 AM from Coimbatore.

The drive through Marayoor and up into Munnar is something else entirely — winding roads, thick forests, misty hills, and that magical moment when the Western Ghats start to unfold right outside your window. Pure cinema.

Check into our resort — tucked into the hills, green all around, your private room waiting just for you and your little one.

After freshening up, it's full resort mode! 🏊 Splash in the swimming pool with the kutties, let them loose on the kids' play area, join in on indoor and outdoor games.

Moms, this is your exhale moment. Sit back, sip something warm, let the mountain air do its thing.

Gala dinner with delicious food and shared conversations. Overnight stay, snuggling up with the kutties.`,
      },
      {
        dayNumber: 2,
        dayLabel: "DAY 2",
        date: "May 10 - Sunday",
        title: "Jeep Safari | Elephant Park | Garden Views | Return",
        description: `We wake up to a calm morning, enjoy a warm breakfast with that crisp Munnar morning air.

Today we take on ALL of Munnar, jeep-style! 🚙

🌿 Botanical Garden — colours, greenery, kids wide-eyed.
🐘 Elephant Park — up close with elephants, a memory for months.
📢 Echo Point — shout, mountain shouts back.
🍃 Tea Factory — leaf to cup, surprisingly fascinating.
🌊 Kundala Dam — pedal & shikara boats on serene hill waters.
💧 Mattupetty Dam — golden hour boating.

Drive back through mountain roads.

Reaching time: 11:30 PM (Sunday Midnight)
Dropping point: Coimbatore railway station or bus stand`,
      },
    ],
    inclusions: [
      "Accommodation - 2 Days / 1 Night in a Premium Stay with Pool",
      "Each mom & kid in a cosy individual room",
      "Private comfortable AC Traveller for transportation",
      "Sightseeing inside Munnar as per itinerary",
      "To and fro transportation from Coimbatore",
      "Toll, parking, state taxes, driver allowances",
      "Breakfast on both days",
      "Boating charges",
      "Jeep Safari charges",
      "All entry charges",
      "Experienced Trip Lead throughout",
      "Private WhatsApp group with DOT team",
    ],
    exclusions: [
      "Train fares to/from Coimbatore",
      "Elephant ride and feeding charges",
      "Any meals not mentioned in inclusions",
      "Personal expenses & activities outside itinerary",
      "Loss/theft of personal belongings",
      "Anything not mentioned in inclusions",
    ],
    thingsToKnow: {
      basicInfo:
        "Total slots: 7 · Age category: 3-12 years · Tamil-based travel community with travelers from across South India.",
      fromOtherLocations:
        "We help arrange train/bus travel with co-travelers from your city to Coimbatore. Fares are not included. We pick you up from the railway station or bus stand directly.",
      money: "Carry approximately ₹4,000 for personal expenses and miscellaneous items.",
      howToBook:
        "Pay ₹4,999 advance to book your slot. First come, first served — only 7 slots. Fill the booking form, complete payment, and you'll receive confirmation via email. Private WhatsApp group created 1 week before the trip.",
    },
    pricingTiers: [
      { label: "Mom", price: 8499, description: "+ 5% GST per person" },
      { label: "Kid", price: 6499, description: "+ 5% GST per person" },
      { label: "Extra Kid", price: 5499, description: "+ 5% GST per person" },
      { label: "Mom & Kid Combo", price: 14998, description: "+ 5% GST" },
    ],
    advanceAmount: 4999,
    gstPercentage: 5,
    cancellationPolicy:
      "Standard DOT cancellation policy applies. See full policy at /cancellation-and-refund-policy.",
  },
  {
    slug: "vietnam-summer-2026",
    title: "Vietnam Voyage",
    tagline: "Hanoi · Halong Bay · Sapa · Hoi An — A Tamil Travel Community Special",
    destination: "Vietnam",
    category: "Abroad",
    heroImage:
      "https://images.unsplash.com/photo-1528127269322-539801943592?w=1920&q=80",
    thumbnailImage:
      "https://images.unsplash.com/photo-1509030450996-dd1a26dda07a?w=1200&q=80",
    duration: "7 Days, 6 Nights",
    startDate: "2026-06-23",
    endDate: "2026-06-29",
    startingFrom: "Chennai (Group Flight)",
    ageGroup: "18 - 45 years",
    totalSlots: 18,
    bookedSlots: 6,
    status: "OPEN",
    isFeatured: true,
    introduction: `Vietnam-ku polama? 🛵🍜

From the chaos of old-town Hanoi, to the emerald islands of Halong Bay, the rice terraces of Sapa and the lantern-lit nights of Hoi An — Vietnam is everything you've seen on Reels, and somehow even more.

This one's our first DOT-Abroad of the year. 18 strangers, one big group flight from Chennai, seven days of pure travel chaos and good food.

Pack light. Bring stories.`,
    whyTravelWithUs: [
      "Personally scouted itinerary covering north & central Vietnam without rushing.",
      "Group flight from Chennai — no figuring out connections alone.",
      "All transfers, intercity flights, overnight cruise & 4-star stays handled.",
      "Tamil-speaking trip leads + local guides at every city.",
    ],
    whoCanJoin:
      "Solo travelers, friend duos and couples between 18-45 years. Valid passport with 6+ months validity required at booking.",
    itineraryDays: [
      {
        dayNumber: 1,
        dayLabel: "DAY 1",
        date: "Jun 23 - Tuesday",
        title: "Chennai → Hanoi | Old Quarter Walk",
        description:
          "Group meets at Chennai airport. Direct flight to Hanoi. Check in, evening walking tour of the Old Quarter, street-food crawl & egg coffee tasting.",
      },
      {
        dayNumber: 2,
        dayLabel: "DAY 2",
        date: "Jun 24 - Wednesday",
        title: "Hanoi → Halong Bay Cruise",
        description:
          "Drive to Halong Bay. Board our overnight cruise through limestone karsts. Kayaking, sunset deck party, seafood dinner & stargazing on water.",
      },
      {
        dayNumber: 3,
        dayLabel: "DAY 3",
        date: "Jun 25 - Thursday",
        title: "Halong Bay → Hanoi → Night Train to Sapa",
        description:
          "Tai Chi at sunrise, cave exploration, return to Hanoi. Board the legendary night train to Sapa.",
      },
      {
        dayNumber: 4,
        dayLabel: "DAY 4",
        date: "Jun 26 - Friday",
        title: "Sapa Rice Terraces Trek",
        description:
          "Easy guided trek through Cat Cat & Lao Chai villages. Lunch with a local Hmong family. Evening at Sapa town.",
      },
      {
        dayNumber: 5,
        dayLabel: "DAY 5",
        date: "Jun 27 - Saturday",
        title: "Sapa → Hanoi → Da Nang → Hoi An",
        description:
          "Fly down to Da Nang, drive to Hoi An. Lantern-lit Old Town walk, Thu Bon river boat ride, group dinner.",
      },
      {
        dayNumber: 6,
        dayLabel: "DAY 6",
        date: "Jun 28 - Sunday",
        title: "Hoi An: Tailor + Beach + Cooking Class",
        description:
          "Custom-tailoring pickup, half-day at An Bang beach, evening Vietnamese cooking class. Free time to wander.",
      },
      {
        dayNumber: 7,
        dayLabel: "DAY 7",
        date: "Jun 29 - Monday",
        title: "Hoi An → Da Nang → Chennai",
        description:
          "Marble Mountains stop, Da Nang airport. Group flight back to Chennai with full hearts and full duffels.",
      },
    ],
    inclusions: [
      "Return group flights Chennai ↔ Vietnam",
      "Internal flights Hanoi → Da Nang",
      "All 4-star hotel stays + 1N Halong cruise",
      "All breakfasts + 4 lunches + 3 dinners",
      "Visa-on-arrival assistance",
      "Local guides at every city",
      "Trip lead + Tamil-speaking host throughout",
      "All entry tickets per itinerary",
    ],
    exclusions: [
      "Visa fees (approx ₹2,500 — paid on arrival)",
      "Travel insurance (mandatory, ~₹1,200)",
      "Lunches/dinners not specified",
      "Any optional activities (sand-boarding, scooter rentals)",
      "Personal expenses, alcohol, tips",
    ],
    thingsToKnow: {
      basicInfo:
        "18 slots only. Indian passport with 6+ months validity required. Visa-on-arrival assistance provided.",
      fromOtherLocations:
        "Group flight is from Chennai. Travelers from Bangalore/Coimbatore/Madurai — we help book matching connecting flights at additional cost.",
      money: "Carry USD 200-250 in cash + a forex card. Vietnamese Dong is the local currency.",
      howToBook:
        "Pay ₹15,000 advance to confirm slot. Balance in two installments. Full payment + passport scan due 30 days before departure.",
    },
    pricingTiers: [
      { label: "Twin Sharing", price: 84999, description: "+ 5% GST per person" },
      { label: "Triple Sharing", price: 79999, description: "+ 5% GST per person" },
      { label: "Single Occupancy", price: 109999, description: "+ 5% GST" },
    ],
    advanceAmount: 15000,
    gstPercentage: 5,
    cancellationPolicy:
      "Standard DOT cancellation policy applies. See full policy at /cancellation-and-refund-policy.",
  },
  {
    slug: "suriyanelli-kolukkumalai-march-2026",
    title: "Suriyanelli & Kolukkumalai",
    tagline: "Sunrise above the clouds · Highest tea estate in the world",
    destination: "Kolukkumalai, Kerala",
    category: "Western Ghats",
    heroImage:
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80",
    thumbnailImage:
      "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&q=80",
    duration: "3 Days, 2 Nights",
    startDate: "2026-03-13",
    endDate: "2026-03-15",
    startingFrom: "Coimbatore",
    ageGroup: "18 - 40 years",
    totalSlots: 14,
    bookedSlots: 14,
    status: "SOLD_OUT",
    isFeatured: false,
    introduction: `The world's highest tea estate. Sunrise from a jeep at 7,900 ft. Stars so loud you can almost hear them.

Kolukkumalai isn't on most itineraries. That's exactly why we go.`,
    whyTravelWithUs: [
      "Off-beat estate stays you can't book yourself.",
      "Pre-dawn jeep safari to Kolukkumalai sunrise point.",
      "Small group of 14 — no tour-bus energy.",
      "Tamil trip leads who know the back-roads.",
    ],
    whoCanJoin:
      "Solo travelers, couples, friend groups between 18-40 years. Reasonable fitness for short hikes required.",
    itineraryDays: [
      {
        dayNumber: 1,
        dayLabel: "DAY 1",
        date: "Mar 13 - Friday",
        title: "Coimbatore → Suriyanelli | Lake & Forest",
        description: "Drive through Marayoor sandalwood forest. Check in, lake walk, group dinner.",
      },
      {
        dayNumber: 2,
        dayLabel: "DAY 2",
        date: "Mar 14 - Saturday",
        title: "Kolukkumalai Jeep Safari | Tea Tasting",
        description: "Pre-dawn 4×4 ride. Sunrise at 7,900 ft. Tea factory walk. Evening bonfire.",
      },
      {
        dayNumber: 3,
        dayLabel: "DAY 3",
        date: "Mar 15 - Sunday",
        title: "Echo Point | Drive Back",
        description: "Lazy breakfast, Echo Point, drive back to Coimbatore. Arrive by 9 PM.",
      },
    ],
    inclusions: [
      "Premium estate stay - 2 Nights",
      "AC Traveller from Coimbatore",
      "Kolukkumalai jeep safari",
      "All breakfasts + 1 dinner",
      "Trip Lead throughout",
    ],
    exclusions: [
      "Lunches not specified",
      "Personal expenses",
      "Anything not in inclusions",
    ],
    thingsToKnow: {
      basicInfo: "14 slots. Currently sold out — DM us to be on the waitlist.",
      fromOtherLocations:
        "We help connect you with co-travelers from your city for shared train/bus travel to Coimbatore.",
      money: "Carry ₹3,000 for personal expenses.",
      howToBook: "Currently sold out. Join waitlist by DM-ing us on Instagram.",
    },
    pricingTiers: [
      { label: "Per Person", price: 11499, description: "+ 5% GST" },
    ],
    advanceAmount: 5000,
    gstPercentage: 5,
    cancellationPolicy:
      "Standard DOT cancellation policy applies. See full policy at /cancellation-and-refund-policy.",
  },
  {
    slug: "thekkady-april-2026",
    title: "Thekkady Wild Escape",
    tagline: "Spice trails, bamboo rafting & jungle nights",
    destination: "Thekkady, Kerala",
    category: "DOT Signatures",
    heroImage:
      "https://images.unsplash.com/photo-1518002171953-a080ee817e1f?w=1920&q=80",
    thumbnailImage:
      "https://images.unsplash.com/photo-1502784444187-359ac186c5bb?w=1200&q=80",
    duration: "2 Days, 1 Night",
    startDate: "2026-04-11",
    endDate: "2026-04-12",
    startingFrom: "Coimbatore",
    ageGroup: "18 - 45 years",
    totalSlots: 12,
    bookedSlots: 9,
    status: "FAST_FILLING",
    isFeatured: true,
    introduction: `Thekkady, but the way Kerala people actually do it.

Bamboo rafts on Periyar lake. A spice plantation walk where you actually crush cardamom in your palm. A jungle stay where the loudest sound at night is cicadas.

Two days. Twelve travelers. One unforgettable weekend.`,
    whyTravelWithUs: [
      "Bamboo rafting slot booked in advance — these sell out months ahead.",
      "Stay inside a working spice plantation, not a generic hotel.",
      "Small group of 12 — keeps the jungle feeling jungle.",
      "Trip lead who's done this trail 6 times.",
    ],
    whoCanJoin: "Solo travelers, couples, friend groups 18-45 years. Light walking required.",
    itineraryDays: [
      {
        dayNumber: 1,
        dayLabel: "DAY 1",
        date: "Apr 11 - Saturday",
        title: "Coimbatore → Thekkady | Spice Walk | Kalari",
        description: "Drive to Thekkady. Check in to plantation stay. Spice walk + traditional Kalaripayattu show + Kathakali.",
      },
      {
        dayNumber: 2,
        dayLabel: "DAY 2",
        date: "Apr 12 - Sunday",
        title: "Bamboo Rafting | Periyar | Drive Back",
        description: "Half-day bamboo rafting on Periyar lake with naturalist. Lunch. Drive back to Coimbatore by 9 PM.",
      },
    ],
    inclusions: [
      "Plantation stay - 1 Night",
      "AC Traveller from Coimbatore",
      "Bamboo rafting (4 hour) — booking included",
      "Spice plantation walk + Kalari show",
      "Breakfast + 1 dinner",
      "Trip Lead",
    ],
    exclusions: [
      "Lunches",
      "Personal expenses",
      "Anything not in inclusions",
    ],
    thingsToKnow: {
      basicInfo: "12 slots. Bamboo rafting requires reasonable balance — no swimming needed.",
      fromOtherLocations: "We coordinate co-travelers heading to Coimbatore from your city.",
      money: "Carry ₹2,500 for lunches and personal expenses.",
      howToBook: "Pay ₹3,500 advance to confirm slot. Bamboo rafting permits issued on full payment.",
    },
    pricingTiers: [
      { label: "Per Person", price: 7499, description: "+ 5% GST" },
    ],
    advanceAmount: 3500,
    gstPercentage: 5,
    cancellationPolicy:
      "Standard DOT cancellation policy applies. See full policy at /cancellation-and-refund-policy.",
  },
];

export function getTripBySlug(slug: string) {
  return trips.find((t) => t.slug === slug);
}

export function getFeaturedTrips() {
  return trips.filter((t) => t.isFeatured);
}
