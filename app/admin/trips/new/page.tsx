import { requireAdmin } from "@/lib/auth";

import { TripForm } from "../TripForm";

export const metadata = { title: "New trip" };

export default async function NewTripPage() {
  await requireAdmin();
  return <TripForm mode="create" />;
}
