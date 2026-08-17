import type { Metadata } from "next";
import { PolicyPageLayout } from "@/components/shared/PolicyPageLayout";
import { siteConfig } from "@/lib/data/siteConfig";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: `Terms governing the use of ${siteConfig.name} services and bookings.`,
};

export default function TermsPage() {
  return (
    <PolicyPageLayout title="Terms & Conditions" kicker="Legal">
      <h2>1. Introduction</h2>
      <p>
        Welcome to {siteConfig.name} (&ldquo;DOT&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;). By accessing our website at <a href={siteConfig.url}>{siteConfig.url}</a> or booking any of our group travel experiences, you agree to be bound by these Terms &amp; Conditions. Please read them carefully before making any payment.
      </p>

      <h2>2. Acceptance of Terms</h2>
      <p>
        By using our website, registering for a trip, or making a booking, you confirm that you are at least 18 years of age (or have parental/guardian consent), that the information you provide is accurate, and that you accept these Terms in full.
      </p>

      <h2>3. Booking & Payment</h2>
      <ul>
        <li>Bookings are confirmed only on receipt of the advance amount specified for each trip.</li>
        <li>The remaining balance must be paid by the date communicated for that specific trip — typically 15 to 30 days before departure.</li>
        <li>All payments are processed via Razorpay. {siteConfig.name} does not store your card or banking details.</li>
        <li>Slots are allocated on a first-come, first-served basis. An unpaid booking does not reserve a slot.</li>
      </ul>

      <h2>4. Trip Conduct</h2>
      <p>
        Travelers are expected to conduct themselves with respect toward fellow travelers, our trip leads, local communities, vendors and the environment. {siteConfig.name} reserves the right to remove any traveler from a trip — without refund — whose behavior is deemed unsafe, illegal, or grossly disrespectful.
      </p>

      <h2>5. Itinerary & Changes</h2>
      <p>
        While we work hard to deliver every itinerary as published, certain elements may change due to weather, road conditions, vendor availability or unforeseen circumstances. We reserve the right to modify any portion of an itinerary at our discretion. Where possible, we will offer comparable alternatives. No refund is owed for itinerary changes that don&apos;t materially shorten the trip.
      </p>

      <h2>6. Force Majeure</h2>
      <p>
        Neither party shall be liable for failure or delay in performance arising from circumstances beyond reasonable control, including but not limited to natural disasters, pandemics, government action, civil unrest, or transport disruption. In such events, the cancellation and refund terms in Section 9 below apply.
      </p>

      <h2>7. Liability & Insurance</h2>
      <p>
        {siteConfig.name} acts as a coordinator of accommodations, transport, and activities through third-party providers. While we choose providers carefully, we are not liable for personal loss, injury, illness, theft of belongings, or delays caused by third parties or circumstances outside our control.
      </p>
      <p>
        We strongly recommend travelers obtain personal travel insurance for international trips. For abroad trips, valid insurance is mandatory.
      </p>

      <h2>8. Intellectual Property</h2>
      <p>
        All content on this website — including the {siteConfig.shortName} brand, photos, itineraries, written content, logos and design — is the intellectual property of {siteConfig.name} and may not be reproduced or used without written permission. Photos taken during trips may be used by us in marketing material; if you&apos;d prefer not to be featured, please tell your trip lead at the start of the trip.
      </p>

      <h2>9. Cancellation & Refunds</h2>
      <p>
        See our <a href="/cancellation-and-refund-policy">Cancellation &amp; Refund Policy</a> for the full schedule of refunds applicable to traveler-initiated cancellations and trip-cancellations by {siteConfig.shortName}.
      </p>

      <h2>10. Governing Law & Disputes</h2>
      <p>
        These Terms are governed by the laws of India. Any dispute arising from these Terms or any booking made with {siteConfig.name} shall be subject to the exclusive jurisdiction of the courts at Coimbatore, Tamil Nadu.
      </p>

      <h2>11. Contact</h2>
      <p>
        For any questions about these Terms, please reach us at <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>, on WhatsApp at {siteConfig.whatsapp}, or via the <a href="/contact">Contact</a> page.
      </p>
    </PolicyPageLayout>
  );
}
