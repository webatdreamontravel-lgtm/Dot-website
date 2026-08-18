import { siteConfig } from "@/lib/data/siteConfig";

/**
 * The absolute base URL this deployment is actually reachable at.
 *
 * Emails and sitemaps need a real origin — a relative "/auth/confirm" means
 * nothing in someone's inbox. Hardcoding the production domain breaks staging
 * (links point at a site the deployment isn't), and setting it by hand means
 * deploying, copying the URL, pasting it into env and deploying again.
 *
 * Vercel already knows the answer, so ask it:
 *
 *   1. NEXT_PUBLIC_SITE_URL — an explicit override always wins. Use it for a
 *      custom domain, or locally.
 *   2. On a production deploy, VERCEL_PROJECT_PRODUCTION_URL — stable across
 *      deploys, and it becomes the custom domain automatically once one is
 *      attached, so no code change is needed at launch.
 *   3. On preview deploys, VERCEL_URL — that build's own address, so a
 *      confirmation link opens the preview you're testing rather than prod.
 *   4. Local development.
 *
 * Server-side only: the VERCEL_* variables aren't exposed to the browser.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return stripSlash(explicit);

  const vercelHost =
    process.env.VERCEL_ENV === "production"
      ? process.env.VERCEL_PROJECT_PRODUCTION_URL
      : process.env.VERCEL_URL;

  // Vercel gives the host with no protocol.
  if (vercelHost) return `https://${stripSlash(vercelHost)}`;

  if (process.env.NODE_ENV === "development") return "http://localhost:3000";

  // Self-hosted or an unknown platform: the configured domain is the best
  // guess left.
  return stripSlash(siteConfig.url);
}

const stripSlash = (s: string) => s.replace(/\/+$/, "");
