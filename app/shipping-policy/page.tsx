import type { Metadata } from "next";
import { PolicyPageLayout } from "@/components/shared/PolicyPageLayout";
import { siteConfig } from "@/lib/data/siteConfig";

export const metadata: Metadata = {
  title: "Shipping Policy",
  description: `${siteConfig.name} delivers travel experiences, not physical goods. Here's how booking confirmations are delivered.`,
};

export default function ShippingPage() {
  return (
    <PolicyPageLayout title="Shipping Policy" kicker="How we deliver">
      <h2>What we offer</h2>
      <p>
        {siteConfig.name} is a travel-experiences company. We curate and operate group trips. We do not sell or ship any physical merchandise as part of our regular service.
      </p>

      <h2>How your booking is delivered</h2>
      <p>
        Once your booking is confirmed and payment is successful, the following will be delivered <strong>electronically</strong>:
      </p>
      <ul>
        <li><strong>Booking confirmation email</strong> — sent to the email address provided during checkout, typically within 24 hours of payment confirmation.</li>
        <li><strong>Travel voucher</strong> — a PDF with your trip details, itinerary, packing checklist and contact numbers, sent via email and WhatsApp.</li>
        <li><strong>Tax invoice</strong> — sent via email after full payment is received, for GST and accounting purposes.</li>
        <li><strong>Trip-specific WhatsApp group invite</strong> — sent approximately 7 days before the trip start date, containing live updates and co-traveler introductions.</li>
      </ul>

      <h2>Delivery timeline</h2>
      <ul>
        <li>Confirmation email: within 24 hours of payment.</li>
        <li>Detailed travel voucher: at least 7 days before the trip.</li>
        <li>Tax invoice: within 7 business days of full payment.</li>
      </ul>
      <p>
        If you have not received your confirmation email within 24 hours, please first check your spam/promotions folder. If still missing, write to <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a> with your transaction reference and we&apos;ll resend it.
      </p>

      <h2>No physical shipping</h2>
      <p>
        Because we do not ship physical goods, no shipping address is required at booking, no shipping charges apply, and no delivery tracking is provided.
      </p>

      <h2>Optional merchandise</h2>
      <p>
        From time to time we may offer trip-branded merchandise (caps, t-shirts) as add-ons to a booking. Should this apply, separate shipping terms — including delivery timeline (typically 7 to 10 business days within India), shipping charges, and tracking — will be communicated at the point of purchase. Such merchandise is shipped only within India.
      </p>

      <h2>Contact</h2>
      <p>
        For any clarifications, email <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>, WhatsApp {siteConfig.whatsapp}, or visit <a href="/contact-us">Contact Us</a>.
      </p>
    </PolicyPageLayout>
  );
}
