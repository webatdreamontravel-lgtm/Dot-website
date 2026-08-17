import type { Metadata } from "next";
import { PolicyPageLayout } from "@/components/shared/PolicyPageLayout";
import { siteConfig } from "@/lib/data/siteConfig";

export const metadata: Metadata = {
  title: "Contact Us",
  description: `Reach Dream On Travel — Coimbatore office, email, phone, WhatsApp and Instagram.`,
};

export default function ContactUsPage() {
  return (
    <PolicyPageLayout title="Contact Us" kicker="Reach us">
      <p>
        For any questions, bookings, support requests or feedback, please use any of the channels below. We respond to all messages within one business day, often the same day.
      </p>

      <h2>Business Information</h2>
      <ul>
        <li><strong>Registered name:</strong> {siteConfig.name}</li>
        <li><strong>Established:</strong> {siteConfig.established}</li>
        <li><strong>Nature of business:</strong> Group travel experiences (Tour Operator)</li>
      </ul>

      <h2>Office Address</h2>
      <p>
        {siteConfig.address.line1}<br />
        {siteConfig.address.city}<br />
        {siteConfig.address.state} - {siteConfig.address.pincode}<br />
        {siteConfig.address.country}
      </p>

      <h2>Email</h2>
      <p>
        <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>
      </p>

      <h2>Phone</h2>
      <p>
        <a href={`tel:${siteConfig.phone.replace(/\s/g, "")}`}>{siteConfig.phone}</a>
      </p>

      <h2>WhatsApp</h2>
      <p>
        <a href={siteConfig.whatsappUrl} target="_blank" rel="noreferrer">{siteConfig.whatsapp}</a>{" "}
        — fastest channel for trip queries and bookings.
      </p>

      <h2>Instagram</h2>
      <p>
        <a href={siteConfig.instagram} target="_blank" rel="noreferrer">{siteConfig.instagramHandle}</a>
      </p>

      <h2>Business Hours</h2>
      <p>{siteConfig.businessHours}</p>
      <p>
        Outside business hours we still try to respond to WhatsApp messages, especially when a trip is in progress and one of our trip leads is on the road.
      </p>

      <h2>Grievance Officer</h2>
      <p>
        For any grievances or complaints not resolved by our regular support channels, you can write directly to our Grievance Officer at <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a> with the subject line &ldquo;Grievance — [Brief description]&rdquo;. We commit to acknowledging within 48 hours and resolving within 30 calendar days.
      </p>
    </PolicyPageLayout>
  );
}
