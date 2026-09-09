import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Instagram, MapPin, Phone, Clock } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { WhatsAppIcon } from "@/components/layout/Navbar";
import { AnimatedHeading } from "@/components/shared/AnimatedHeading";
import { legalConfig, siteConfig } from "@/lib/data/siteConfig";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Talk to Dream On Travel — WhatsApp, Instagram, email or just walk into our Coimbatore studio.",
};

const channels = [
  {
    icon: WhatsAppIcon,
    label: "WhatsApp",
    value: siteConfig.phone,
    href: siteConfig.whatsappUrl,
    accent: "bg-[#25D366]",
    description: "Fastest reply. We&apos;re mostly here.",
  },
  {
    icon: Instagram,
    label: "Instagram",
    value: siteConfig.instagramHandle,
    href: siteConfig.instagram,
    accent: "bg-gradient-to-br from-coral via-yellow to-teal",
    description: "DM us. Stories, reels, the works.",
  },
  {
    icon: Mail,
    label: "Email",
    value: siteConfig.email,
    href: `mailto:${siteConfig.email}`,
    accent: "bg-teal",
    description: "For long messages and bookings.",
  },
];

export default function ContactPage() {
  return (
    <>
      <Navbar variant="solid" />
      <main className="bg-cream pt-32 md:pt-40 pb-24">
        <section className="mx-auto max-w-7xl px-6 md:px-8">
          <p className="font-script text-2xl text-teal">Hello, hello →</p>
          <AnimatedHeading as="h1" className="mt-2 text-4xl md:text-8xl">
            Drop us a line.
            <br />
            <span className="italic text-coral">Or three.</span>
          </AnimatedHeading>
          <p className="mt-6 max-w-xl text-base text-navy/65 md:text-lg">
            Bookings, trip questions, partnerships, or just to chat — we read everything.
          </p>

          {/* 3 channels */}
          <div className="mt-14 grid md:grid-cols-3 gap-5">
            {channels.map((c) => (
              <a
                key={c.label}
                href={c.href}
                target="_blank"
                rel="noreferrer"
                className="group rounded-3xl border border-navy/10 bg-cream-soft p-7 hover:border-navy/20 hover:bg-cream transition"
              >
                <div className={`h-14 w-14 rounded-2xl ${c.accent} text-cream flex items-center justify-center`}>
                  <c.icon className="h-6 w-6" />
                </div>
                <h2 className="mt-6 font-display text-3xl tracking-tight">{c.label}</h2>
                <p className="mt-1 text-navy/60 text-sm">{c.description}</p>
                <p className="mt-5 text-teal font-medium underline underline-offset-4 group-hover:no-underline break-all">
                  {c.value}
                </p>
              </a>
            ))}
          </div>

          {/* Address + form */}
          <div className="mt-20 grid lg:grid-cols-5 gap-10 lg:gap-14 items-start">
            <div className="lg:col-span-2">
              <h2 className="font-display text-3xl md:text-5xl">Visit us</h2>
              <p className="mt-3 font-script text-2xl text-coral">If you&apos;re ever in Coimbatore.</p>

              <ul className="mt-8 space-y-5">
                <li className="flex items-start gap-4">
                  <MapPin className="mt-1 h-5 w-5 flex-shrink-0 text-teal" />
                  <div>
                    <p className="font-medium">Office address</p>
                    <p className="text-navy/65 mt-0.5">
                      {legalConfig.addressLines.join(", ")}<br />
                      {siteConfig.address.city}, {siteConfig.address.state} - {siteConfig.address.pincode}<br />
                      {siteConfig.address.country}
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <Phone className="mt-1 h-5 w-5 flex-shrink-0 text-teal" />
                  <div>
                    <p className="font-medium">Phone</p>
                    <a href={`tel:${siteConfig.phone.replace(/\s/g, "")}`} className="text-navy/65 hover:text-teal transition">
                      {siteConfig.phone}
                    </a>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <Clock className="mt-1 h-5 w-5 flex-shrink-0 text-teal" />
                  <div>
                    <p className="font-medium">Hours</p>
                    <p className="text-navy/65">{siteConfig.businessHours}</p>
                  </div>
                </li>
              </ul>

              <div className="mt-8 aspect-[4/3] rounded-2xl overflow-hidden border border-navy/10 bg-cream-soft relative">
                <iframe
                  title={`${siteConfig.name} location map`}
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3917.9089!2d76.9558!3d11.0168!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTHCsDAxJzAwLjQiTiA3NsKwNTcnMjAuOCJF!5e0!3m2!1sen!2sin"
                  width="100%"
                  height="100%"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="border-0"
                />
              </div>
            </div>

            {/* The form that was here had no action and no handler — it
                collected four fields and dropped them, under a note saying
                so. A contact page whose contact method silently fails is
                worse than one that doesn't offer it, so these are the
                channels that actually reach someone. */}
            <div className="lg:col-span-3 rounded-3xl border border-navy/10 bg-cream-soft p-8 md:p-10">
              <h2 className="font-display text-3xl md:text-5xl">Talk to us.</h2>
              <p className="mt-3 text-navy/65">
                We reply within a day, often sooner. WhatsApp is fastest — it&apos;s where the
                trip leads actually are.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href={siteConfig.whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary flex-1 justify-center"
                >
                  Message us on WhatsApp
                </a>
                <a
                  href={`mailto:${siteConfig.email}`}
                  className="btn flex-1 justify-center border border-navy/15 bg-cream text-navy hover:bg-white"
                >
                  Email us
                </a>
              </div>

              <hr className="my-8 border-navy/10" />

              <p className="text-sm font-medium text-navy/75">Booking a specific trip?</p>
              <p className="mt-1.5 text-navy/65">
                Go straight to the{" "}
                <Link href="/trips" className="text-teal underline underline-offset-4">
                  trip you want
                </Link>{" "}
                and book a seat — you&apos;ll see the full price with taxes before anything is
                confirmed, and we&apos;ll call you to arrange payment.
              </p>

              <p className="mt-6 text-sm text-navy/55">
                Prefer the phone? {siteConfig.phone} · {siteConfig.businessHours}
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
