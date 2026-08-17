import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { getAdminTrip } from "@/lib/queries/admin";
import { getReviewDrafts } from "@/lib/reviewsPayload";

import { TripForm, type TripFormValues } from "../TripForm";

export const metadata = { title: "Edit trip" };

/** <input type="date"> only accepts yyyy-mm-dd. */
const isoDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function EditTripPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { saved } = await searchParams;

  const [trip, reviews] = await Promise.all([getAdminTrip(id), getReviewDrafts(id)]);
  if (!trip) notFound();

  const values: TripFormValues = {
    id: trip.id,
    slug: trip.slug,
    title: trip.title,
    batchName: trip.batchName,
    tagline: trip.tagline,
    destination: trip.destination,
    category: trip.category,
    cardImage: trip.cardImage,
    heroImage: trip.heroImage,
    startDate: isoDate(trip.startDate),
    endDate: isoDate(trip.endDate),
    durationLabel: trip.durationLabel,
    startingFrom: trip.startingFrom,
    ageGroup: trip.ageGroup,
    totalSeats: trip.totalSeats,
    seatsBooked: trip.seatsBooked,
    minParticipants: trip.minParticipants,
    // Paise in the database, rupees in the form.
    price: trip.pricePaise / 100,
    comparePrice: trip.comparePricePaise ? trip.comparePricePaise / 100 : null,
    offerLabel: trip.offerLabel,
    offerEndsAt: isoDate(trip.offerEndsAt),
    advance: trip.advancePaise ? trip.advancePaise / 100 : null,
    gstPercent: trip.gstPercent,
    tcsPercent: trip.tcsPercent,
    instalmentCount: trip.instalmentCount,
    razorpayEnabled: trip.razorpayEnabled,
    autoCloseWhenFull: trip.autoCloseWhenFull,
    showSeatsLeft: trip.showSeatsLeft,
    status: trip.status,
    isFeatured: trip.isFeatured,
    introduction: trip.introduction,
    itinerary: trip.itinerary,
    inclusions: trip.inclusions,
    exclusions: trip.exclusions,
    thingsToKnow: trip.thingsToKnow,
    cancellationPolicy: trip.cancellationPolicy,
    moodboard: trip.moodboard,
    reviews,
  };

  return <TripForm mode="edit" values={values} saved={saved === "1"} />;
}
