import type { Metadata } from "next";
import { Mail, Instagram, MapPin, Phone, Clock } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { WhatsAppIcon } from "@/components/layout/Navbar";
import { AnimatedHeading } from "@/components/shared/AnimatedHeading";
import { siteConfig } from "@/lib/data/siteConfig";

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
          <AnimatedHeading as="h1" className="mt-2 text-5xl md:text-8xl">
            Drop us a line.
            <br />
            <span className="italic text-coral">Or three.</span>
          </AnimatedHeading>
          <p className="mt-6 max-w-xl text-lg text-navy/65">
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
              <h2 className="font-display text-4xl md:text-5xl">Visit us</h2>
              <p className="mt-3 font-script text-2xl text-coral">If you&apos;re ever in Coimbatore.</p>

              <ul className="mt-8 space-y-5">
                <li className="flex items-start gap-4">
                  <MapPin className="mt-1 h-5 w-5 flex-shrink-0 text-teal" />
                  <div>
                    <p className="font-medium">Studio address</p>
                    <p className="text-navy/65 mt-0.5">
                      {siteConfig.address.line1},<br />
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

            <form className="lg:col-span-3 rounded-3xl border border-navy/10 bg-cream-soft p-8 md:p-10 space-y-5">
              <h2 className="font-display text-4xl md:text-5xl">Or just type below.</h2>
              <p className="text-navy/65">We reply within a day, often sooner.</p>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Your name" type="text" id="name" placeholder="What should we call you?" />
                <Field label="Phone or email" type="text" id="contact" placeholder="So we can reply" />
              </div>
              <Field label="Which trip are you eyeing?" type="text" id="trip" placeholder="Optional — e.g. Munnar, Vietnam, anything" />
              <div>
                <label htmlFor="message" className="text-sm font-medium text-navy/75">Message</label>
                <textarea
                  id="message"
                  rows={5}
                  placeholder="Hi DOT, I'd like to..."
                  className="mt-1.5 w-full rounded-xl border border-navy/15 bg-cream px-4 py-3 text-navy placeholder:text-navy/35 focus:border-teal focus:bg-white outline-none transition"
                />
              </div>
              <button type="button" className="btn btn-primary w-full justify-center">
                Send message
              </button>
              <p className="text-xs text-navy/50">
                This form is non-functional in the preview. Please reach us via WhatsApp or email for the fastest response.
              </p>
            </form>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function Field({ label, type, id, placeholder }: { label: string; type: string; id: string; placeholder: string }) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-navy/75">{label}</label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-xl border border-navy/15 bg-cream px-4 py-3 text-navy placeholder:text-navy/35 focus:border-teal focus:bg-white outline-none transition"
      />
    </div>
  );
}
