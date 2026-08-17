import Link from "next/link";

import { Logo } from "@/components/shared/Logo";

/**
 * Shared frame for sign in and sign up.
 *
 * Both screens sat on their own layout before, which is how two pages of the
 * same flow drift apart. One shell means the card, spacing and footer can
 * only ever match.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Signup needs two columns on desktop; sign in doesn't. */
  wide?: boolean;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-cream px-4 py-12 md:py-16">
      <Link href="/" className="mb-7" aria-label="Dream On Travel home">
        <Logo variant="dark" />
      </Link>

      <div
        className={
          "w-full rounded-3xl border border-navy/10 bg-white p-7 shadow-[0_20px_50px_-24px_rgba(15,30,61,0.35)] md:p-9 " +
          (wide ? "max-w-xl" : "max-w-md")
        }
      >
        <h1 className="font-display text-[1.9rem] leading-tight tracking-tight text-navy">
          {title}
        </h1>
        {subtitle && <p className="mt-1.5 text-[0.92rem] leading-relaxed text-navy/60">{subtitle}</p>}

        <div className="mt-6">{children}</div>

        {footer && (
          <div className="mt-6 border-t border-navy/8 pt-5 text-center text-[0.88rem] text-navy/60">
            {footer}
          </div>
        )}
      </div>

      <Link
        href="/"
        className="mt-7 text-[0.85rem] text-navy/45 underline underline-offset-4 transition hover:text-navy"
      >
        Back to the site
      </Link>
    </main>
  );
}
