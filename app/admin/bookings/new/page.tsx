import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireAdmin } from "@/lib/auth";
import { getBookableTripsForAdmin } from "@/lib/queries/admin";
import { EmptyState, Panel } from "../../ui";
import { NewBookingForm } from "./NewBookingForm";

export const metadata = { title: "New booking" };

export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ tripId?: string }>;
}) {
  await requireAdmin();
  const { tripId } = await searchParams;

  // Published, not yet departed — the only trips that can take a booking.
  const bookable = await getBookableTripsForAdmin();

  return (
    <>
      <header className="mb-6">
        <Link
          href="/admin/bookings"
          className="mb-1 inline-flex items-center gap-1.5 text-[0.82rem] text-[#5a6785] hover:text-navy"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All bookings
        </Link>
        <h1 className="font-display text-[1.85rem] font-semibold tracking-tight">New booking</h1>
        <p className="mt-0.5 text-[0.85rem] text-[#8b96ad]">
          For a booking taken over WhatsApp, at a stall, or in person.
        </p>
      </header>

      {bookable.length === 0 ? (
        <Panel>
          <EmptyState
            title="No trips are open for booking"
            body="Publish a trip with a future departure date first."
            action={
              <Link
                href="/admin/trips"
                className="inline-block rounded-lg bg-navy px-3.5 py-2 text-[0.85rem] font-medium text-cream"
              >
                Manage trips
              </Link>
            }
          />
        </Panel>
      ) : (
        <NewBookingForm
          initialTripId={tripId}
          trips={bookable.map((t) => ({
            id: t.id,
            title: t.title,
            batchName: t.batchName,
            seatsAvailable: t.seatsAvailable,
            pricePaise: t.pricePaise,
            gstPercent: t.gstPercent,
            tcsPercent: t.tcsPercent,
            advancePaise: t.advancePaise,
            startDate: t.startDate.toISOString(),
          }))}
        />
      )}
    </>
  );
}
