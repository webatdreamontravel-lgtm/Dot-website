import type { Metadata } from "next";
import { PolicyPageLayout } from "@/components/shared/PolicyPageLayout";
import { legalConfig, paymentsConfig, siteConfig } from "@/lib/data/siteConfig";

export const metadata: Metadata = {
  title: "Contact Us",
  description: `Reach Dream On Travel — registered business details, Coimbatore office, email, phone, WhatsApp and Instagram.`,
};

export default function ContactUsPage() {
  return (
    <PolicyPageLayout title="Contact Us" kicker="Reach us">
      <p>
        For any questions, bookings, support requests or feedback, please use any of the channels below. We respond to all messages within one business day, often the same day.
      </p>

      <h2>Merchant Business Details</h2>
      {/* Razorpay's review compares this block against the application form,
          so it is a plain definition list rather than prose — every field
          they look for, in the order they look for it. */}
      <ul>
        <li>
          <strong>Registered business name:</strong> {legalConfig.registeredName}
          {legalConfig.entityType && ` (${legalConfig.entityType})`}
        </li>
        <li><strong>Trading / brand name:</strong> {siteConfig.name}</li>
        <li><strong>Nature of business:</strong> Tour operator — curated group travel experiences</li>
        <li><strong>Operating since:</strong> {siteConfig.established}</li>
        <li><strong>Website:</strong> <a href={siteConfig.url}>{siteConfig.url}</a></li>
        {legalConfig.gstin && <li><strong>GSTIN:</strong> {legalConfig.gstin}</li>}
        {legalConfig.pan && <li><strong>PAN:</strong> {legalConfig.pan}</li>}
        {legalConfig.registrationNumber && (
          <li><strong>Tourism registration:</strong> {legalConfig.registrationNumber}</li>
        )}
      </ul>

      <h2>Registered Office Address</h2>
      <p>
        {legalConfig.addressLines.map((line) => (
          <span key={line}>
            {line}
            <br />
          </span>
        ))}
        {siteConfig.address.city}, {siteConfig.address.state} {siteConfig.address.pincode}
        <br />
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
        In accordance with the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, the contact details of our Grievance Officer are:
      </p>
      <ul>
        <li><strong>Name:</strong> {legalConfig.grievanceOfficer.name}</li>
        <li><strong>Designation:</strong> {legalConfig.grievanceOfficer.designation}</li>
        <li><strong>Email:</strong> <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a></li>
        <li><strong>Phone:</strong> <a href={`tel:${siteConfig.phone.replace(/\s/g, "")}`}>{siteConfig.phone}</a></li>
      </ul>
      <p>
        Please use the subject line &ldquo;Grievance — [Brief description]&rdquo;. We commit to acknowledging within 48 hours and resolving within 30 calendar days.
      </p>

      <h2>Payment-related queries</h2>
      {paymentsConfig.gatewayLive ? (
        <p>
          Payments on this website are processed by <strong>{paymentsConfig.gatewayLegalName}</strong>. For a failed payment, a duplicate charge, or a refund that has not reached your account within the timeline set out in our <a href="/cancellation-and-refund-policy">Cancellation &amp; Refund Policy</a>, write to <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a> with your booking reference and the transaction ID. We take these up with the gateway on your behalf — you should not have to chase them yourself.
        </p>
      ) : (
        <p>
          This website does not take payment online. Payment is arranged directly with our team by{" "}
          {paymentsConfig.offlineMethods} after you book. For a payment we haven&apos;t acknowledged, or a refund that hasn&apos;t reached you within the timeline set out in our <a href="/cancellation-and-refund-policy">Cancellation &amp; Refund Policy</a>, write to <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a> with your booking reference and the UTR or transaction reference.
        </p>
      )}
      <p>
        <strong>A safety note:</strong> we will never ask for your card number, CVV, UPI PIN, OTP or net-banking password — not by email, not on a call, not on WhatsApp. If anyone claiming to be from {siteConfig.name} asks for these, it is not us. Please report it to the number above.
      </p>
    </PolicyPageLayout>
  );
}
