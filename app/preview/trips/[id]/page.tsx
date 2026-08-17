import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { TripPageBody } from "@/components/trip/TripPageBody";
import { requireAdmin } from "@/lib/auth";
import { getTripForPreview } from "@/lib/queries/trips";

export const metadata = {
  title: "Preview",
  robots: { index: false, follow: false },
};

/**
 * Draft preview.
 *
 * Renders the identical TripPageBody the public route uses, so this shows
 * exactly what will ship — not an approximation that can drift.
 *
 * Admin-only: getTripForPreview() ignores the publish gate, so requireAdmin()
 * above is what keeps unfinished trips private.
 */
export default async function TripPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const trip = await getTripForPreview(id);
  if (!trip) notFound();

  const isDraft = true; // reached only from the admin editor

  return (
    <>
      {/* Deliberately not sticky: the site's own navbar is sticky at top-0,
          and two competing sticky bars fight over the same space. This sits
          in normal flow, with a floating pill below carrying the escape
          route once it scrolls out of view. */}
      <div className="relative z-[70] flex flex-wrap items-center gap-3 bg-[#b26a00] px-5 py-2.5 text-cream">
        <Eye className="h-4 w-4 flex-none" />
        <span className="text-[0.85rem] font-semibold">
          Preview — this is how the page will look
        </span>
        <span className="hidden text-[0.82rem] text-cream/80 sm:inline">
          Only you can see this. {isDraft && "Publish the trip to make it public."}
        </span>
      </div>

      <Navbar variant="transparent" />
      <main>
        <TripPageBody trip={trip} />
      </main>
      <Footer />

      {/* Always reachable, however far down the page they've scrolled. */}
      <Link
        href={`/admin/trips/${id}`}
        className="fixed bottom-5 right-5 z-[80] inline-flex items-center gap-2 rounded-full bg-[#b26a00] px-4 py-2.5 text-[0.85rem] font-semibold text-cream shadow-lg transition hover:bg-[#8f5500]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to editing
      </Link>
    </>
  );
}
