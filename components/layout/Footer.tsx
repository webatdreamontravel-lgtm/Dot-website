import Link from "next/link";
import { Instagram, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { WhatsAppIcon } from "@/components/layout/Navbar";
import { legalConfig, navLinks, policyLinks, siteConfig } from "@/lib/data/siteConfig";

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-navy text-cream">
      <div className="grain opacity-[0.04]" aria-hidden />
      <div className="mx-auto max-w-7xl px-6 md:px-8 pt-20 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-8">
          <div className="md:col-span-5">
            <Logo variant="light" className="text-3xl" />
            <p className="mt-5 max-w-sm text-cream/70 leading-relaxed">
              {siteConfig.tagline}. Curated group travel experiences across India and beyond — since {siteConfig.established}.
            </p>
            <div className="mt-6 flex items-center gap-2">
              <a
                href={siteConfig.instagram}
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="h-10 w-10 inline-flex items-center justify-center rounded-full bg-cream/10 hover:bg-cream/20 transition"
              >
                <Instagram className="h-5 w-5" />
              </a>
              <a
                href={siteConfig.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="WhatsApp"
                className="h-10 w-10 inline-flex items-center justify-center rounded-full bg-cream/10 hover:bg-cream/20 transition"
              >
                <WhatsAppIcon className="h-5 w-5" />
              </a>
            </div>
          </div>

          <div className="md:col-span-3">
            <h3 className="text-sm uppercase tracking-[0.2em] text-cream/50">Explore</h3>
            <ul className="mt-4 space-y-2.5">
              {navLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-cream/85 hover:text-yellow transition">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-4">
            <h3 className="text-sm uppercase tracking-[0.2em] text-cream/50">Reach Us</h3>
            <ul className="mt-4 space-y-3 text-cream/85">
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow" />
                <span>
                  {siteConfig.address.line1}, {siteConfig.address.city},
                  <br />
                  {siteConfig.address.state} - {siteConfig.address.pincode}, {siteConfig.address.country}
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="h-4 w-4 flex-shrink-0 text-yellow" />
                <a href={`mailto:${siteConfig.email}`} className="hover:text-yellow transition">
                  {siteConfig.email}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="h-4 w-4 flex-shrink-0 text-yellow" />
                <a href={`tel:${siteConfig.phone.replace(/\s/g, "")}`} className="hover:text-yellow transition">
                  {siteConfig.phone}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 border-t border-cream/15 pt-8">
          <h3 className="text-sm uppercase tracking-[0.2em] text-cream/50">Policies</h3>
          <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {policyLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-cream/75 hover:text-yellow transition">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Payment disclosure. A gateway's review team looks for this, and so
            does anyone deciding whether it's safe to type a card number into
            a site they found on Instagram. */}
        <div className="mt-10 flex flex-col gap-4 border-t border-cream/15 pt-8 md:flex-row md:items-center md:justify-between">
          <p className="flex items-center gap-2 text-xs text-cream/60">
            <ShieldCheck className="h-4 w-4 flex-shrink-0 text-yellow" aria-hidden />
            Payments secured by Razorpay · UPI, Cards, Net Banking &amp; EMI · All prices in INR (₹)
          </p>
          <p className="text-xs text-cream/50">
            We never see or store your card details.
          </p>
        </div>

        <div className="mt-8 flex flex-col md:flex-row md:items-start md:justify-between gap-4 text-xs text-cream/55">
          <div className="space-y-1">
            <p>
              © {new Date().getFullYear()} {legalConfig.registeredName}. All rights reserved.
            </p>
            {/* Only worth saying when the two actually differ — otherwise it
                reads "X is a trading name of X". */}
            {(legalConfig.registeredName !== siteConfig.name || legalConfig.gstin) && (
              <p className="text-cream/40">
                {legalConfig.registeredName !== siteConfig.name &&
                  `${siteConfig.name} is a trading name of ${legalConfig.registeredName}`}
                {legalConfig.registeredName !== siteConfig.name && legalConfig.gstin && " · "}
                {legalConfig.gstin && `GSTIN ${legalConfig.gstin}`}
              </p>
            )}
          </div>
          <p className="font-script text-base text-cream/70">
            Made with chai &amp; chaos in Coimbatore.
          </p>
        </div>
      </div>
    </footer>
  );
}
