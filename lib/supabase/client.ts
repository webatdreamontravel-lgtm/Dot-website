import { createBrowserClient } from "@supabase/ssr";

/// Browser-side Supabase client. Used ONLY for auth (OTP sign-in, sign-out,
/// session refresh). All data access goes through server code + Prisma —
/// every table has RLS on with no policies, so this client cannot read them
/// even if someone tries.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
