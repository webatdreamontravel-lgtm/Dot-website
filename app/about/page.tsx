import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { AnimatedHeading } from "@/components/shared/AnimatedHeading";
import { stats } from "@/lib/data/pastTrips";
import { siteConfig } from "@/lib/data/siteConfig";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "We're a Tamil travel community that runs small, scouted group trips across India and beyond. Strangers to friends since 2023.",
};

const values = [
  { title: "Scout, then sell", body: "If we haven't done it ourselves, we don't put it on the website." },
  { title: "Small groups", body: "We cap most trips at 12-18. Big enough for energy, small enough for everyone to matter." },
  { title: "Tamil at heart", body: "Tamil-speaking trip leads, songs you grew up with, conversations that feel like home." },
  { title: "Honest pricing", body: "What you pay is what you get. No surprise add-ons on Day 2." },
];

const team = [
  {
    name: "Ajay Murugan",
    role: "Founder & Chief Trip Lead",
    avatar: "https://i.pravatar.cc/300?img=12",
  },
  {
    name: "Priya Devi",
    role: "Operations & Stays",
    avatar: "https://i.pravatar.cc/300?img=49",
  },
  {
    name: "Karthik R.",
    role: "Routes & Recces",
    avatar: "https://i.pravatar.cc/300?img=33",
  },
];

export default function AboutPage() {
  return (
    <>
      <Navbar variant="solid" />
      <main className="bg-cream pt-32 md:pt-40">
        <section className="mx-auto max-w-5xl px-6 md:px-8 pb-24">
          <p className="font-script text-2xl text-teal">A small story →</p>
          <AnimatedHeading as="h1" className="mt-2 text-5xl md:text-8xl">
            We started in <span className="italic text-coral">2023.</span>
            <br />
            With one bus and a lot of <span className="italic text-teal">faith.</span>
          </AnimatedHeading>

          <div className="mt-10 grid md:grid-cols-2 gap-8 text-lg text-navy/75 leading-relaxed">
            <p>
              Dream On Travel began as a half-serious WhatsApp idea between two friends who kept missing each other on solo trips. The first trip — Wayanad, twelve travelers, mostly strangers — felt less like a tour and more like a college reunion. People asked when the next one was before the bus had even reached home.
            </p>
            <p>
              Three years and 30+ trips later, we&apos;re still small on purpose. We scout every route ourselves before announcing a trip. We keep the groups small. We hire Tamil-speaking trip leads. And we obsess over the small things — the songs at sunrise, the chai stop with the view, the little detour nobody asked for but everyone remembers.
            </p>
          </div>
        </section>

        {/* Stats */}
        <section className="bg-cream-soft py-16">
          <div className="mx-auto max-w-7xl px-6 md:px-8">
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {stats.map((s) => (
                <div key={s.label} className="text-center md:text-left">
                  <dd className="font-display text-5xl md:text-7xl tracking-tight">{s.value}</dd>
                  <dt className="mt-1 text-sm uppercase tracking-[0.18em] text-navy/60">{s.label}</dt>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Values */}
        <section className="py-24 md:py-28">
          <div className="mx-auto max-w-7xl px-6 md:px-8">
            <AnimatedHeading className="text-5xl md:text-7xl mb-12">
              What we <span className="italic text-teal">care about</span>
            </AnimatedHeading>
            <div className="grid md:grid-cols-2 gap-5">
              {values.map((v, i) => (
                <div
                  key={v.title}
                  className="rounded-3xl border border-navy/10 bg-cream-soft p-7 md:p-9"
                >
                  <p className="font-display text-6xl text-navy/15">0{i + 1}</p>
                  <h3 className="mt-2 font-display text-2xl md:text-3xl">{v.title}</h3>
                  <p className="mt-2 text-navy/70 leading-relaxed">{v.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Team */}
        <section className="bg-navy text-cream py-24 md:py-28 relative overflow-hidden">
          <div className="grain opacity-[0.05]" aria-hidden />
          <div className="relative mx-auto max-w-7xl px-6 md:px-8">
            <p className="font-script text-2xl text-yellow">The DOT crew</p>
            <AnimatedHeading className="mt-1 text-5xl md:text-7xl mb-12">
              Built by people who <span className="italic text-yellow">travel a lot.</span>
            </AnimatedHeading>
            <div className="grid md:grid-cols-3 gap-6">
              {team.map((m) => (
                <figure key={m.name} className="group">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-cream/5">
                    <Image
                      src={m.avatar}
                      alt={m.name}
                      fill
                      sizes="(min-width: 768px) 33vw, 100vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>
                  <figcaption className="mt-4">
                    <p className="font-display text-2xl">{m.name}</p>
                    <p className="text-cream/65 text-sm mt-0.5">{m.role}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 md:py-28 text-center">
          <div className="mx-auto max-w-2xl px-6 md:px-8">
            <AnimatedHeading className="text-5xl md:text-6xl">
              Come <span className="italic text-coral">somewhere</span> with us.
            </AnimatedHeading>
            <p className="mt-5 text-navy/70 text-lg">
              The next trip is always closer than you think.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <Link href="/trips" className="btn btn-primary">View upcoming trips</Link>
              <a href={siteConfig.whatsappUrl} target="_blank" rel="noreferrer" className="btn bg-navy text-cream">
                Say hi on WhatsApp
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
