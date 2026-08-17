import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { policyLinks, siteConfig } from "@/lib/data/siteConfig";

type PolicyPageLayoutProps = {
  title: string;
  kicker?: string;
  lastUpdated?: string;
  children: React.ReactNode;
};

export function PolicyPageLayout({
  title,
  kicker = "Policy",
  lastUpdated = "April 2026",
  children,
}: PolicyPageLayoutProps) {
  return (
    <>
      <Navbar variant="solid" />
      <main className="bg-cream pt-32 md:pt-40 pb-24">
        <div className="mx-auto max-w-6xl px-6 md:px-8">
          <div className="grid lg:grid-cols-[1fr_280px] gap-12">
            <article>
              <p className="font-script text-2xl text-teal">{kicker}</p>
              <h1 className="mt-2 font-display text-4xl md:text-6xl tracking-tight leading-[1.02]">
                {title}
              </h1>
              <p className="mt-4 text-sm text-navy/55">
                Last updated: {lastUpdated} · {siteConfig.name}
              </p>

              <div
                className="prose-policy mt-10 text-navy/80 leading-relaxed
                  [&_h2]:font-display [&_h2]:text-2xl [&_h2]:md:text-3xl [&_h2]:tracking-tight [&_h2]:text-navy [&_h2]:mt-12 [&_h2]:mb-3
                  [&_h3]:font-display [&_h3]:text-xl [&_h3]:md:text-2xl [&_h3]:tracking-tight [&_h3]:text-navy [&_h3]:mt-8 [&_h3]:mb-2
                  [&_p]:my-3
                  [&_ul]:my-3 [&_ul]:list-disc [&_ul]:list-outside [&_ul]:pl-5 [&_ul]:space-y-1.5
                  [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:list-outside [&_ol]:pl-5 [&_ol]:space-y-1.5
                  [&_a]:text-teal [&_a]:underline [&_a]:underline-offset-4
                  [&_strong]:font-semibold [&_strong]:text-navy
                "
              >
                {children}
              </div>
            </article>

            <aside className="lg:sticky lg:top-28 self-start">
              <div className="rounded-3xl border border-navy/10 bg-cream-soft p-6">
                <h2 className="font-display text-xl mb-3">All policies</h2>
                <ul className="space-y-1.5 text-sm">
                  {policyLinks.map((p) => (
                    <li key={p.href}>
                      <Link
                        href={p.href}
                        className="block py-1.5 text-navy/75 hover:text-teal hover:underline underline-offset-4"
                      >
                        {p.label}
                      </Link>
                    </li>
                  ))}
                </ul>
                <hr className="my-4 border-navy/10" />
                <p className="text-xs text-navy/55 mb-2 uppercase tracking-[0.18em]">Need help?</p>
                <p className="text-sm text-navy/75">
                  Email{" "}
                  <a className="text-teal underline underline-offset-4" href={`mailto:${siteConfig.email}`}>
                    {siteConfig.email}
                  </a>
                </p>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
