import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/// Server-side Supabase client bound to the request's cookies.
/// Use this to read the signed-in user, never to query application tables.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Session refresh is handled by middleware instead.
          }
        },
      },
    },
  );
}

/// The authenticated user, or null.
///
/// Always getUser(), never getSession(): getSession() trusts the cookie
/// as-is, while getUser() revalidates the JWT with Supabase. On a server
/// that makes authorization decisions, the difference matters.
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
