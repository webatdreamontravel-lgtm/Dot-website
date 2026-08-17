"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CircleUser } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Sign-in / account link in the site header.
 *
 * Without this there was no way to sign in from the site at all, and no way
 * to tell whether you already were — the only sign-in prompt a customer ever
 * saw was the redirect when they clicked Book, and anyone with a live session
 * never saw even that.
 *
 * Auth is read in the browser rather than passed down from each page, so the
 * header doesn't have to be threaded through the ten routes that render it,
 * and so it updates the moment someone signs in or out in another tab.
 */
function useSignedIn() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (active) setSignedIn(Boolean(data.user));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session?.user));
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return signedIn;
}

export function AccountMenu({ tone }: { tone: "dark" | "light" }) {
  const pathname = usePathname();
  const signedIn = useSignedIn();

  // Nothing until we know: flashing "Sign in" at someone who is already
  // signed in is worse than a beat of empty space.
  if (signedIn === null) return null;

  const className = cn(
    "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
    tone === "dark"
      ? "text-navy/80 hover:bg-navy/5 hover:text-navy"
      : "text-cream/85 hover:bg-cream/10 hover:text-cream",
  );

  if (signedIn) {
    return (
      <Link href="/account" className={className}>
        <CircleUser className="h-4 w-4" />
        My trips
      </Link>
    );
  }

  return (
    <Link
      // Come back to whatever they were looking at, not the home page.
      href={`/login?next=${encodeURIComponent(pathname)}`}
      className={className}
    >
      <CircleUser className="h-4 w-4" />
      Sign in
    </Link>
  );
}

/** Same thing sized for the mobile sheet, where the nav links are display type. */
export function AccountMenuMobile() {
  const pathname = usePathname();
  const signedIn = useSignedIn();

  if (signedIn === null) return null;

  return (
    <Link
      href={signedIn ? "/account" : `/login?next=${encodeURIComponent(pathname)}`}
      className="flex items-center gap-2.5 py-3 font-display text-2xl text-navy"
    >
      <CircleUser className="h-5 w-5 text-navy/50" />
      {signedIn ? "My trips" : "Sign in"}
    </Link>
  );
}
