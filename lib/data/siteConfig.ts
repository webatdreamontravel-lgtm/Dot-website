export const siteConfig = {
  name: "Dream On Travel",
  shortName: "DOT",
  tagline: "Strangers to Friends Tamil Travel Community",
  description:
    "Curated group travel experiences across India. Tamil community trips, handcrafted itineraries, premium stays.",
  url: "https://dreamontravel.in",
  email: "hello@dreamontravel.in",
  phone: "+91 86104 44353",
  whatsapp: "+91 86104 44353",
  whatsappUrl: "https://api.whatsapp.com/send/?phone=918610444353&text&type=phone_number&app_absent=0",
  instagram: "https://www.instagram.com/dream_on_travel_",
  instagramHandle: "@dream_on_travel_",
  address: {
    line1: "Dream On Travel",
    line2: "Coimbatore",
    city: "Coimbatore",
    state: "Tamil Nadu",
    pincode: "641001",
    country: "India",
  },
  businessHours: "Monday to Saturday, 10 AM - 7 PM IST",
  established: 2023,
};

/**
 * The details a payment gateway checks before it will let us take money.
 *
 * Razorpay's activation review compares the website against the application
 * form line by line. The registered name here MUST be the entity on the
 * application — the brand name "Dream On Travel" is what customers see, but
 * a proprietorship or LLP is what actually holds the bank account, and a
 * mismatch between the two is the most common reason a travel merchant gets
 * sent back for clarification.
 *
 * Anything still null is rendered nowhere. That is deliberate: an invented
 * GSTIN on a page a payment gateway is auditing is far worse than a missing
 * one, and a wrong number would have to be corrected under their nose.
 */
export const legalConfig = {
  /**
   * Registered/legal entity name. Must match the PAN and bank account given
   * to Razorpay. Falls back to the brand name so the pages still read, but
   * this needs confirming with Priya & Santhosh before submission.
   */
  registeredName: "Dream On Travel",
  /** "Proprietorship" | "Partnership" | "LLP" | "Private Limited" | ... */
  entityType: "Proprietorship" as string | null,
  /** 15-character GSTIN. Required, since every trip is priced with 5% GST. */
  gstin: null as string | null,
  /** Business PAN. Displayed only if the founders want it public. */
  pan: null as string | null,
  /** Tour operator / IATA / state tourism registration, if held. */
  registrationNumber: null as string | null,
  /**
   * Street address for the Contact Us page. Razorpay wants a complete,
   * verifiable address — not just a city — so line1 must be a real door
   * number and street before this goes in for review.
   */
  addressLines: [
    // Door number and street go here. The city, state, pincode and country
    // are appended from siteConfig.address, so don't repeat them.
    "Dream On Travel",
  ] as string[],
  /** Named person accountable for grievances, per the IT Rules 2021. */
  grievanceOfficer: {
    name: "Santhosh",
    designation: "Grievance Officer",
  },
} as const;

export const navLinks = [
  { href: "/trips", label: "Trips" },
  { href: "/past-journeys", label: "Past Journeys" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export const policyLinks = [
  { href: "/terms-and-conditions", label: "Terms & Conditions" },
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/cancellation-and-refund-policy", label: "Cancellation & Refund Policy" },
  { href: "/shipping-policy", label: "Shipping Policy" },
  { href: "/pricing-details", label: "Pricing Details" },
  { href: "/contact-us", label: "Contact Us" },
];

export const tripCategories = [
  { slug: "dot-signatures", label: "DOT Signatures", emoji: "✨", description: "Handcrafted experiences" },
  { slug: "long-trips", label: "Long Trips", emoji: "🛣️", description: "Slow journeys, deeper stories" },
  { slug: "coastal-carnivals", label: "Coastal Carnivals", emoji: "🏖️", description: "Sun, sand, salt" },
  { slug: "cultural-feast", label: "Cultural Feast", emoji: "🪔", description: "Festivals & traditions" },
  { slug: "monsoon-trips", label: "Monsoon Trips", emoji: "☔", description: "Petrichor specials" },
  { slug: "western-ghats", label: "Western Ghats", emoji: "⛰️", description: "Cloud-kissed peaks" },
  { slug: "festival-specials", label: "Travel Festival Specials", emoji: "🎉", description: "Big calendar moments" },
  { slug: "abroad", label: "Abroad", emoji: "✈️", description: "Across borders, with vibes" },
];
