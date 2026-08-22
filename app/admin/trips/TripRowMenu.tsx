"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Eye,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  Pencil,
  PowerOff,
  Radio,
  Users,
} from "lucide-react";

import { setTripPublished } from "./actions";

const MENU_WIDTH = 232;
/** Enough for five items plus the hint line; only used to decide flip. */
const MENU_ESTIMATED_HEIGHT = 300;
const GAP = 6;

/**
 * Per-row actions.
 *
 * The menu is rendered through a portal onto document.body rather than
 * positioned inside the row. It has to be: the table sits in a Panel with
 * `overflow-hidden` and its own `overflow-x-auto` wrapper, and an absolutely
 * positioned child of either one gets clipped — or worse, extends the
 * scrollable area and shunts the table sideways. Fixed coordinates taken
 * from the trigger's rect escape both boxes.
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
  const [error, setError] = useState<string | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const [pending, startTransition] = useTransition();

  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const b = btnRef.current?.getBoundingClientRect();
    if (!b) return;
    // Flip above the trigger when there isn't room below, so rows at the
    // bottom of a long table don't open a menu off-screen.
    const below = window.innerHeight - b.bottom - GAP;
    const above = b.top - GAP;
    // Open downwards unless there's genuinely more room above.
    const flip = below < MENU_ESTIMATED_HEIGHT && above > below;
    const room = Math.max(flip ? above : below, 0);
    // On a short viewport neither side fits a full menu, so cap it and let
    // the menu scroll rather than run off the screen.
    const height = Math.min(MENU_ESTIMATED_HEIGHT, room);
    setPos({
      top: flip ? Math.max(GAP, b.top - height - GAP) : b.bottom + GAP,
      // Right-aligned to the trigger, clamped so it can't leave the viewport.
      left: Math.max(GAP, Math.min(b.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - GAP)),
      maxHeight: Math.max(height, 120),
    });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !btnRef.current?.contains(target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    // Scrolling would leave a fixed menu stranded away from its row, so it
    // closes rather than chasing the trigger.
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  const toggle = () => {
    setError(null);
    startTransition(async () => {
      const res = await setTripPublished(tripId, !isPublished);
      if (res.error) setError(res.error);
      else setOpen(false);
    });
  };

  const menu = pos && (
    <div
      ref={menuRef}
      role="menu"
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        width: MENU_WIDTH,
        maxHeight: pos.maxHeight,
      }}
      className="z-50 overflow-y-auto overscroll-contain rounded-xl border border-[#e3e7ee] bg-white py-1 shadow-lg"
    >
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

      <div className="my-1 border-t border-[#e3e7ee]" />

      {/* The only item here that changes what the public sees, so it's
          separated from the navigation above and coloured by consequence. */}
      <button
        type="button"
        role="menuitem"
        onClick={toggle}
        disabled={pending}
        className={
          "flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[0.85rem] transition disabled:opacity-60 " +
          (isPublished ? "text-[#a33] hover:bg-[#fdf3f3]" : "text-[#0f7a55] hover:bg-[#f1faf5]")
        }
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 flex-none animate-spin" />
        ) : isPublished ? (
          <PowerOff className="h-3.5 w-3.5 flex-none" />
        ) : (
          <Radio className="h-3.5 w-3.5 flex-none" />
        )}
        {pending ? "Saving…" : isPublished ? "Deactivate" : "Activate"}
      </button>

      <p className="px-3.5 pb-2 pt-0.5 text-[0.72rem] leading-snug text-[#8b96ad]">
        {isPublished
          ? "Takes it off the site. Existing bookings are unaffected."
          : "Puts it live on the site and in search."}
      </p>

      {error && (
        <p role="alert" className="px-3.5 pb-2 text-[0.75rem] leading-snug text-[#a33]">
          {error}
        </p>
      )}
    </div>
  );

  return (
    <div className="flex justify-end">
      <button
        ref={btnRef}
        type="button"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="grid h-8 w-8 place-items-center rounded-lg text-[#5a6785] transition hover:bg-[#eef1f6] hover:text-[#16203a]"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && typeof document !== "undefined" && createPortal(menu, document.body)}
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
      role="menuitem"
      {...(newTab ? { target: "_blank" } : {})}
      className="flex items-center gap-2.5 px-3.5 py-2 text-[0.85rem] text-[#16203a] transition hover:bg-[#f6f7f9]"
    >
      <Icon className="h-3.5 w-3.5 flex-none text-[#5a6785]" />
      {children}
    </Link>
  );
}
