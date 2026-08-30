import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/siteUrl";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The admin portal and a customer's own account are behind auth, so a
      // crawler only ever gets a redirect from them — but they still burn
      // crawl budget and surface as soft-404s in Search Console. The booking
      // routes are excluded for a different reason: they're per-trip
      // duplicates of the trip page with none of its content.
      disallow: ["/admin", "/account", "/api/", "/preview", "/login", "/signup", "/auth/"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
