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

  /**
   * An explicit override wins — unless it points at localhost on a machine
   * that plainly isn't localhost.
   *
   * This is the failure this guard exists for: .env.local gets copied into
   * Vercel's environment variables, NEXT_PUBLIC_SITE_URL comes along with
   * it, and every verification email in production then carries
   * "http://localhost:3000/auth/confirm?token_hash=…". The link is
   * unclickable for the customer, the signup is unfinishable, and nothing
   * errors — the emails send perfectly, they just cannot be used.
   *
   * A localhost URL is never right in a deployed environment, so it is
   * ignored rather than obeyed, and we fall through to the host the
   * platform reports.
   */
  if (explicit && !(isDeployed() && isLocalhost(explicit))) {
    return stripSlash(explicit);
  }

  if (explicit) {
    // Loud, because the symptom is otherwise invisible: mail that looks
    // fine and does nothing.
    console.warn(
      `[siteUrl] Ignoring NEXT_PUBLIC_SITE_URL="${explicit}" — it points at ` +
        `localhost but this is a deployed environment. Remove it from the ` +
        `hosting environment variables, or set it to the real domain.`,
    );
  }

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

/** Running somewhere that isn't a developer's machine. */
function isDeployed(): boolean {
  return Boolean(process.env.VERCEL || process.env.NETLIFY) || process.env.NODE_ENV === "production";
}

function isLocalhost(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0" || hostname === "::1";
  } catch {
    // Not a parseable URL — treat it as suspect rather than trusting it.
    return /localhost|127\.0\.0\.1/.test(url);
  }
}
