import type { MetadataRoute } from "next";
import { getPublishedTripSlugs } from "@/lib/queries/trips";
import { siteUrl } from "@/lib/siteUrl";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticPaths = [
    "",
    "/trips",
    "/past-journeys",
    "/about",
    "/contact",
    "/terms-and-conditions",
    "/privacy-policy",
    "/cancellation-and-refund-policy",
    "/shipping-policy",
    "/pricing-details",
    "/contact-us",
  ];

  const staticEntries: MetadataRoute.Sitemap = staticPaths.map((p) => ({
    url: `${siteUrl()}${p}`,
    lastModified: now,
    changeFrequency: p === "" ? "weekly" : "monthly",
    priority: p === "" ? 1.0 : 0.7,
  }));

  const slugs = await getPublishedTripSlugs();
  const tripEntries: MetadataRoute.Sitemap = slugs.map((slug) => ({
    url: `${siteUrl()}/trips/${slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.9,
  }));

  return [...staticEntries, ...tripEntries];
}
