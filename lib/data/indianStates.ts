/**
 * States and union territories, for the signup address fields.
 *
 * A dropdown rather than free text: "TN", "Tamilnadu" and "Tamil Nadu" are
 * three different strings to a database, and the team will want to filter
 * travellers by where they're joining from.
 */
export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
  // Most of this community travels from South India, but trips take joiners
  // from anywhere — an "outside India" option beats forcing a wrong answer.
  "Outside India",
] as const;

export const STATE_OPTIONS = INDIAN_STATES.map((s) => ({ value: s, label: s }));

/** Preselected, because nearly everyone joining right now travels from here. */
export const DEFAULT_STATE = "Tamil Nadu";

/**
 * Tamil Nadu cities and district headquarters.
 *
 * A list rather than a text box for the home state: it keeps "Trichy",
 * "Tiruchi" and "Tiruchirappalli" from becoming three separate answers when
 * the team wants to see where a batch is travelling from, and it saves
 * typing for the majority who pick one of the first few.
 */
export const TAMIL_NADU_CITIES = [
  "Ambur",
  "Ariyalur",
  "Chengalpattu",
  "Chennai",
  "Coimbatore",
  "Cuddalore",
  "Dharmapuri",
  "Dindigul",
  "Erode",
  "Hosur",
  "Kallakurichi",
  "Kanchipuram",
  "Kanyakumari",
  "Karaikudi",
  "Karur",
  "Krishnagiri",
  "Kumbakonam",
  "Madurai",
  "Mayiladuthurai",
  "Nagapattinam",
  "Nagercoil",
  "Namakkal",
  "Neyveli",
  "Ooty (Udhagamandalam)",
  "Perambalur",
  "Pollachi",
  "Pudukkottai",
  "Rajapalayam",
  "Ramanathapuram",
  "Ranipet",
  "Salem",
  "Sivaganga",
  "Sivakasi",
  "Tenkasi",
  "Thanjavur",
  "Theni",
  "Thoothukudi (Tuticorin)",
  "Tiruchirappalli (Trichy)",
  "Tirunelveli",
  "Tirupathur",
  "Tiruppur",
  "Tiruvallur",
  "Tiruvannamalai",
  "Tiruvarur",
  "Vellore",
  "Villupuram",
  "Virudhunagar",
  // Nobody should be blocked from signing up by a list that missed their town.
  "Other",
] as const;

export const TAMIL_NADU_CITY_OPTIONS = TAMIL_NADU_CITIES.map((c) => ({ value: c, label: c }));
