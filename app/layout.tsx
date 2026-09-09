import type { Metadata, Viewport } from "next";
import { fraunces, inter, caveat } from "@/lib/fonts";
import { legalConfig, siteConfig } from "@/lib/data/siteConfig";
import { siteUrl } from "@/lib/siteUrl";
import { Analytics } from "@/components/shared/Analytics";
import { ClarityAnalytics } from "@/components/shared/Clarity";
import { CursorFollower } from "@/components/shared/CursorFollower";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [
    "Tamil travel community",
    "group trips India",
    "Munnar trip",
    "Vietnam group trip",
    "Coimbatore travel",
    "Dream On Travel",
    "DOT trips",
    "South India group travel",
    "curated trips India",
  ],
  authors: [{ name: siteConfig.name }],
  creator: siteConfig.name,
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: siteUrl(),
    siteName: siteConfig.name,
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    images: [
      {
        url: "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=1200&q=80",
        width: 1200,
        height: 630,
        alt: siteConfig.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    images: ["https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=1200&q=80"],
  },
  robots: { index: true, follow: true },
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = {
  themeColor: "#0f1e3d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    name: siteConfig.name,
    legalName: legalConfig.registeredName,
    url: siteUrl(),
    logo: `${siteUrl()}/favicon.ico`,
    description: siteConfig.description,
    email: siteConfig.email,
    telephone: siteConfig.phone,
    foundingDate: `${siteConfig.established}-01-01`,
    address: {
      "@type": "PostalAddress",
      streetAddress: legalConfig.addressLines.join(", "),
      addressLocality: siteConfig.address.city,
      addressRegion: siteConfig.address.state,
      postalCode: siteConfig.address.pincode,
      addressCountry: "IN",
    },
    sameAs: [siteConfig.instagram],
    priceRange: "₹₹",
    ...(legalConfig.gstin ? { taxID: legalConfig.gstin } : {}),
  };

  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${caveat.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-cream text-navy">
        <Analytics />
        <ClarityAnalytics />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        <CursorFollower />
        {children}
      </body>
    </html>
  );
}
