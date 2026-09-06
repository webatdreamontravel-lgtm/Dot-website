import "server-only";

import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/supabase/server";

export type SessionProfile = {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  /** Asked at signup, for rooming. Copied onto the lead traveller at booking. */
  gender: "MALE" | "FEMALE" | null;
  role: "CUSTOMER" | "ADMIN";
};

/** The signed-in profile, or null. Safe to call anywhere server-side. */
export async function getSessionProfile(): Promise<SessionProfile | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { id: true, email: true, fullName: true, phone: true, gender: true, role: true },
  });

  return profile ?? null;
}

/**
 * Gate for every admin page and server action.
 *
 * Because Prisma connects as the database owner it bypasses RLS entirely —
 * the database will happily return every booking to any query we write.
 * This function is therefore the ONLY thing standing between a signed-in
 * customer and the whole admin surface. Call it first, in every single
 * admin route handler and action, without exception.
 */
export async function requireAdmin(): Promise<SessionProfile> {
  const profile = await getSessionProfile();

  if (!profile) redirect("/login?next=/admin");
  if (profile.role !== "ADMIN") redirect("/?error=forbidden");

  return profile;
}

/**
 * Where someone belongs after signing in.
 *
 * Admins go straight to the panel; everyone else goes back to the site.
 * Sending a traveller to /admin only bounces them out again, and sending an
 * admin to the landing page means an extra click on every single sign-in.
 */
export function destinationForRole(role: SessionProfile["role"]) {
  return role === "ADMIN" ? "/admin" : "/";
}

/**
 * Paths you can only be on while signed in.
 *
 * The distinction matters because `next` arrives from two very different
 * places. A gate sets it when it turns someone away from a page they were
 * actually trying to reach — that's a purposeful destination and should win.
 * The header's Sign in link also sets it, to whatever page you happened to
 * be reading — that's incidental, and letting it win meant an admin who
 * clicked Sign in from the home page was returned to the home page instead
 * of the panel.
 */
function isGatedPath(path: string) {
  return (
    path.startsWith("/admin") ||
    path.startsWith("/preview") ||
    path.startsWith("/account") ||
    /^\/trips\/[^/]+\/book/.test(path)
  );
}

/**
 * Final landing page for a sign-in, given the account's role and whatever
 * `next` came along for the ride.
 */
export function resolveDestination(role: SessionProfile["role"], requested?: string | null) {
  const safe =
    requested && requested.startsWith("/") && !requested.startsWith("//") ? requested : null;

  // Only a page they were genuinely trying to reach overrides the role, and
  // a customer is never sent into the admin panel whatever the URL says.
  if (safe && isGatedPath(safe) && (role === "ADMIN" || !safe.startsWith("/admin"))) {
    return safe;
  }

  return destinationForRole(role);
}

/** Gate for customer-facing account pages. */
export async function requireUser(nextPath = "/account"): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return profile;
}
