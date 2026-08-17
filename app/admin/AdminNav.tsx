"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Map, Receipt, Star, Users } from "lucide-react";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Dashboard", icon: LayoutGrid, exact: true },
  { href: "/admin/trips", label: "Trips", icon: Map },
  { href: "/admin/bookings", label: "Bookings", icon: Receipt },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    // Horizontal scroller on phones — the founders will use this at the
    // festival stall, not at a desk.
    <nav className="flex gap-1.5 overflow-x-auto md:flex-col md:overflow-visible">
      {LINKS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-none items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-[0.875rem] transition",
              active
                ? "bg-teal font-medium text-cream"
                : "text-cream/70 hover:bg-cream/[0.07] hover:text-cream",
            )}
          >
            <Icon className="h-4 w-4 flex-none opacity-90" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
