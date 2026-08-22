import type { Metadata } from "next";
import { PolicyPageLayout } from "@/components/shared/PolicyPageLayout";
import { legalConfig, paymentsConfig, siteConfig } from "@/lib/data/siteConfig";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: `Terms governing the use of ${siteConfig.name} services and bookings.`,
};

export default function TermsPage() {
  return (
    <PolicyPageLayout title="Terms & Conditions" kicker="Legal">
      <h2>1. Who you are contracting with</h2>
      <p>
        This website at <a href={siteConfig.url}>{siteConfig.url}</a> is owned and operated by{" "}
        <strong>{legalConfig.registeredName}</strong>
        {legalConfig.entityType && `, a ${legalConfig.entityType.toLowerCase()} `}
        registered in Coimbatore, Tamil Nadu, India, trading as {siteConfig.name} (&ldquo;DOT&rdquo;,
        &ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;). By accessing this website or booking any
        of our group travel experiences, you agree to be bound by these Terms &amp; Conditions. Please
        read them carefully before making any payment.
      </p>

      <h2>2. What we sell</h2>
      <p>
        {siteConfig.name} is a tour operator. We design and operate <strong>curated group travel
        experiences</strong> — multi-day trips within India and overseas, sold to individual travellers
        who join a shared departure. A single booking buys a seat on a specific dated departure and the
        inclusions listed on that trip&apos;s page: accommodation, ground transport, listed activities,
        listed meals and an accompanying trip lead.
      </p>
      <p>
        We are not an airline, a hotel, or a ticketing agent. We do not sell standalone flight or hotel
        reservations. Where an itinerary includes flights, they are arranged as part of the package
        through licensed third parties.
      </p>

      <h2>3. Eligibility & acceptance</h2>
      <p>
        By using our website, registering for a trip, or making a booking, you confirm that you are at
        least 18 years of age (or are booking with the consent of a parent or guardian), that the
        information you provide about yourself and your co-travellers is accurate, and that you accept
        these Terms in full. Travellers under 18 may join only when accompanied by a parent or guardian
        on the same booking.
      </p>

      <h2>4. Booking &amp; payment</h2>
      <ul>
        <li>Bookings are confirmed only on receipt of the advance amount specified for each trip.</li>
        <li>The remaining balance must be paid by the date communicated for that specific trip — typically 15 to 30 days before departure.</li>
        <li>All prices are quoted and charged in <strong>Indian Rupees (INR)</strong>, exclusive of GST. Applicable GST, and TCS on overseas packages, are shown as separate lines before you pay. See <a href="/pricing-details">Pricing Details</a>.</li>
        <li>Slots are allocated on a first-come, first-served basis. An unpaid booking does not reserve a slot.</li>
      </ul>

      <h2>5. Payment processing</h2>
      {paymentsConfig.gatewayLive ? (
        <p>
          Online payments are collected through <strong>{paymentsConfig.gatewayLegalName}</strong>, a
          payment aggregator authorised by the Reserve Bank of India. Card, UPI and net-banking details
          are entered on the aggregator&apos;s PCI-DSS compliant infrastructure and are never seen,
          transmitted or stored by {siteConfig.name}. We retain only the transaction reference and the
          amount, which we need in order to reconcile your booking and process any refund.
        </p>
      ) : (
        <p>
          This website does not currently take payment online. Booking a seat records your request and
          holds it; a member of our team then contacts you to confirm the trip and arrange payment by{" "}
          {paymentsConfig.offlineMethods}. <strong>No card, UPI or bank credentials are ever entered on
          this site</strong>, and we do not ask for them by email.
        </p>
      )}
      <p>
        When online payment is introduced, it will be handled by a payment aggregator authorised by the
        Reserve Bank of India on PCI-DSS compliant infrastructure, and these Terms will be updated before
        it goes live. {siteConfig.name} will not store card or banking credentials at any point.
      </p>

      <h2>6. Trip conduct</h2>
      <p>
        Travelers are expected to conduct themselves with respect toward fellow travelers, our trip leads, local communities, vendors and the environment. {siteConfig.name} reserves the right to remove any traveler from a trip — without refund — whose behavior is deemed unsafe, illegal, or grossly disrespectful.
      </p>

      <h2>7. Itinerary &amp; changes</h2>
      <p>
        While we work hard to deliver every itinerary as published, certain elements may change due to weather, road conditions, vendor availability or unforeseen circumstances. We reserve the right to modify any portion of an itinerary at our discretion. Where possible, we will offer comparable alternatives. No refund is owed for itinerary changes that don&apos;t materially shorten the trip.
      </p>
      <p>
        Every trip has a minimum group size, shown on the trip page. If a departure does not reach it, we
        cancel the trip and refund in full under Section 12.
      </p>

      <h2>8. Force majeure</h2>
      <p>
        Neither party shall be liable for failure or delay in performance arising from circumstances beyond reasonable control, including but not limited to natural disasters, pandemics, government action, civil unrest, or transport disruption. In such events, the cancellation and refund terms in Section 12 below apply.
      </p>

      <h2>9. Liability &amp; insurance</h2>
      <p>
        {siteConfig.name} acts as a coordinator of accommodations, transport, and activities through third-party providers. While we choose providers carefully, we are not liable for personal loss, injury, illness, theft of belongings, or delays caused by third parties or circumstances outside our control.
      </p>
      <p>
        We strongly recommend travelers obtain personal travel insurance for international trips. For abroad trips, valid insurance is mandatory.
      </p>

      <h2>10. Your account &amp; acceptable use</h2>
      <p>
        You are responsible for keeping your account credentials confidential and for all bookings made
        through your account. You agree not to use this website to submit false traveller details, to make
        bookings you do not intend to honour, to attempt to access another traveller&apos;s booking, or to
        interfere with the operation of the site. We may suspend or close an account used this way.
      </p>

      <h2>11. Intellectual property</h2>
      <p>
        All content on this website — including the {siteConfig.shortName} brand, photos, itineraries, written content, logos and design — is the intellectual property of {legalConfig.registeredName} and may not be reproduced or used without written permission. Photos taken during trips may be used by us in marketing material; if you&apos;d prefer not to be featured, please tell your trip lead at the start of the trip.
      </p>

      <h2>12. Cancellation &amp; refunds</h2>
      <p>
        Our <a href="/cancellation-and-refund-policy">Cancellation &amp; Refund Policy</a> sets out the full
        schedule of refunds for traveller-initiated cancellations and for trips cancelled by {siteConfig.shortName}.
        It forms part of these Terms. Approved refunds are returned to the original payment method within
        7 business days of approval.
      </p>

      <h2>13. Privacy</h2>
      <p>
        Personal data you give us is handled as described in our <a href="/privacy-policy">Privacy Policy</a>,
        which also forms part of these Terms.
      </p>

      <h2>14. Governing law &amp; disputes</h2>
      <p>
        These Terms are governed by the laws of India. Any dispute arising from these Terms or any booking made with {legalConfig.registeredName} shall be subject to the exclusive jurisdiction of the courts at Coimbatore, Tamil Nadu.
      </p>

      <h2>15. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. The version in force for your booking is the one
        published on the date you paid. Material changes will be communicated to travellers with an active
        booking by email.
      </p>

      <h2>16. Contact</h2>
      <p>
        For any questions about these Terms, please reach us at <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>, on WhatsApp at {siteConfig.whatsapp}, or via the <a href="/contact-us">Contact Us</a> page.
      </p>
    </PolicyPageLayout>
  );
}
