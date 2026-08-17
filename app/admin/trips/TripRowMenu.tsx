"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Eye, ExternalLink, MoreHorizontal, Pencil, Users } from "lucide-react";

/**
 * Per-row actions.
 *
 * A plain popover rather than a dropdown library — it needs to do three
 * things, and pulling in a menu primitive for that is more surface than the
 * feature deserves.
 */
export function TripRowMenu({
  tripId,
  slug,
  isPublished,
  bookingCount,
}: {
  tripId: string;
  slug: string;
  isPublished: boolean;
  bookingCount: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative flex justify-end">
      <button
        type="button"
        aria-label="More actions"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="grid h-8 w-8 place-items-center rounded-lg text-[#5a6785] transition hover:bg-[#eef1f6] hover:text-[#16203a]"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-30 w-56 overflow-hidden rounded-xl border border-[#e3e7ee] bg-white py-1 shadow-lg">
          <Item href={`/admin/trips/${tripId}/bookings`} icon={Users}>
            Booking details
            <span className="ml-auto rounded-full bg-[#eef1f6] px-2 py-0.5 text-[0.72rem] font-semibold text-[#5a6785]">
              {bookingCount}
            </span>
          </Item>
          <Item href={`/admin/trips/${tripId}`} icon={Pencil}>
            Edit trip
          </Item>
          <Item href={`/preview/trips/${tripId}`} icon={Eye} newTab>
            Preview
          </Item>
          {isPublished && (
            <Item href={`/trips/${slug}`} icon={ExternalLink} newTab>
              Live page
            </Item>
          )}
        </div>
      )}
    </div>
  );
}

function Item({
  href, icon: Icon, newTab, children,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  newTab?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      {...(newTab ? { target: "_blank" } : {})}
      className="flex items-center gap-2.5 px-3.5 py-2 text-[0.85rem] text-[#16203a] transition hover:bg-[#f6f7f9]"
    >
      <Icon className="h-3.5 w-3.5 flex-none text-[#5a6785]" />
      {children}
    </Link>
  );
}
