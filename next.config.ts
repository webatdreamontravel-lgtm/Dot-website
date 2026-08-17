import type { NextConfig } from "next";

/**
 * Supabase Storage host, derived from the project URL so it can't drift from
 * whatever project the app is actually pointed at.
 */
const supabaseHostname = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
      : "*.supabase.co";
  } catch {
    return "*.supabase.co";
  }
})();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "i.pravatar.cc" },
      // Trip photos uploaded through the admin.
      {
        protocol: "https",
        hostname: supabaseHostname,
        pathname: "/storage/v1/object/public/**",
      },
    ],

    /**
     * Next 16 added an SSRF guard that resolves each upstream image host and
     * rejects the request if ANY resolved address is outside its public-IP
     * allowlist. On networks that use DNS64/NAT64 — this machine included —
     * supabase.co resolves to both real IPv4 addresses and synthesized
     * 64:ff9b::/96 (RFC 6052) addresses. The synthesized ones fail the check,
     * so every uploaded photo 400s with '"url" parameter is not allowed'.
     * It's intermittent, because it depends on the order DNS returns records.
     *
     * Disabled in development only. Production hosts resolve Supabase to
     * ordinary public addresses, so the guard stays on where it matters, and
     * remotePatterns above still restrict which hosts can be fetched at all.
     */
    dangerouslyAllowLocalIP: process.env.NODE_ENV === "development",
  },
};

export default nextConfig;
