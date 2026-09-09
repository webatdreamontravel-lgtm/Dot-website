import Script from "next/script";

/**
 * Google Analytics 4.
 *
 * `next/script` rather than raw <script> tags: Next needs to know about these
 * to load them once and keep them out of the client-side navigation cycle. A
 * plain inline <script> in the App Router is re-evaluated on some renders and
 * would double-count.
 *
 * `afterInteractive` is Google's own recommendation for gtag and what
 * @next/third-parties uses internally. `beforeInteractive` would block first
 * paint to load an analytics script, which is the wrong trade on a page whose
 * job is selling trips.
 *
 * The measurement ID is not a secret — it ships in the page source of every
 * site that uses GA — so it lives here with an env override rather than
 * requiring a variable to be set before analytics works at all.
 */
const MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID ?? "G-JLQQRQDQF0";

export function Analytics() {
  // Skipped in development so `npm run dev` doesn't file localhost sessions,
  // bounce rates and test bookings against the real property. Vercel preview
  // builds DO report, since NODE_ENV is production there — worth knowing if a
  // preview ever shows up in the numbers.
  if (process.env.NODE_ENV === "development" || !MEASUREMENT_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${MEASUREMENT_ID}');
        `}
      </Script>
    </>
  );
}
