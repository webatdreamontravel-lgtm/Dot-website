/**
 * Traveller facts the booking form collects beyond a name and a number.
 *
 * Kept here rather than inline in the form so the form, the two server
 * actions that persist a booking, and anything that later renders a roster
 * all agree on the stored values and on how they are spelled on screen.
 */

/**
 * Stored on `booking_travellers.gender`, which is a plain string column —
 * these are the only values this codebase writes into it, matching the
 * `Gender` enum used on profiles so the two can be compared without a
 * translation table.
 */
export const TRAVELLER_GENDERS = ["MALE", "FEMALE"] as const;

export type TravellerGender = (typeof TRAVELLER_GENDERS)[number];

export const GENDER_LABEL: Record<TravellerGender, string> = {
  MALE: "Male",
  FEMALE: "Female",
};

export function isTravellerGender(value: unknown): value is TravellerGender {
  return typeof value === "string" && (TRAVELLER_GENDERS as readonly string[]).includes(value);
}

/**
 * Whether this seat has to declare a gender.
 *
 * Only the seats added beyond the person booking. Seat one belongs to the
 * account holder, who has already told us who they are; the extra seats are
 * people the trip has never met, and rooming a group of strangers is the
 * thing this answer is for. Asking the lead again would be a field with no
 * new information in it.
 */
export function genderRequiredForSeat(index: number): boolean {
  return index > 0;
}
