import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session on every request and gates /admin.
 *
 * The gate here is a cheap first line only — middleware runs on the edge
 * and can't reach the database to check the admin role. Every admin page
 * and action re-checks with requireAdmin(). Never rely on this alone.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() revalidates the token with Supabase; getSession() would just
  // trust whatever cookie arrived.
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtected =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/preview") ||
    pathname.startsWith("/account");

  /**
   * Redirecting needs a NEW response object, which does NOT carry the
   * cookies Supabase just set on `response`.
   *
   * That matters because getUser() above may have rotated an expired access
   * token. Supabase invalidates the old refresh token the moment it issues a
   * new pair, so dropping the new cookies logs the user out permanently —
   * they sign in, browse for a while, then get bounced to /login and can't
   * get back in without signing in again. Copy them across.
   */
  const redirectTo = (pathnameTarget: string, withNext: boolean) => {
    const url = request.nextUrl.clone();
    url.pathname = pathnameTarget;
    url.search = "";
    if (withNext) url.searchParams.set("next", pathname);

    const redirectResponse = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }
    return redirectResponse;
  };

  if (isProtected && !user) return redirectTo("/login", true);
  if (pathname === "/login" && user) return redirectTo("/admin", false);

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and image files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
