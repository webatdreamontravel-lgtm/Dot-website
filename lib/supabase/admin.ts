import "server-only";

import { createClient } from "@supabase/supabase-js";

/// Service-role client. Bypasses RLS and every auth check.
///
/// The `server-only` import above makes the build FAIL if this module is
/// ever pulled into a client component — which is the point. A leaked
/// service-role key is total compromise of the database.
///
/// Used for: Storage uploads from admin routes, and admin user management.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
