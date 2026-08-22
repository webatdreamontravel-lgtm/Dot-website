import type { Metadata } from "next";
import { PolicyPageLayout } from "@/components/shared/PolicyPageLayout";
import { paymentsConfig, siteConfig } from "@/lib/data/siteConfig";

export const metadata: Metadata = {
  title: "Cancellation & Refund Policy",
  description: `Cancellation and refund terms for ${siteConfig.name} bookings.`,
};

const tiers = [
  { window: "30 days or more before the trip", refund: "90% refund", note: "Of the total amount paid (excluding payment-gateway fees)." },
  { window: "15 to 29 days before the trip", refund: "50% refund", note: "Of the total amount paid." },
  { window: "7 to 14 days before the trip", refund: "25% refund", note: "Of the total amount paid." },
  { window: "Less than 7 days before the trip", refund: "No refund", note: "Bookings within this window are non-refundable." },
];

export default function CancellationPage() {
  return (
    <PolicyPageLayout title="Cancellation & Refund Policy" kicker="Refunds & cancellations">
      <p>
        We get it — plans change. This policy explains what happens if you need to cancel a {siteConfig.name} booking, and what we do if we have to cancel a trip ourselves.
      </p>

      <h2>1. Cancellation by Traveler</h2>
      <p>
        If you initiate a cancellation, the refund applicable depends on how far in advance you let us know. We calculate the refund based on the date we receive your written cancellation request (via email or WhatsApp), measured against the trip&apos;s start date.
      </p>

      <div className="not-prose my-6 overflow-hidden rounded-2xl border border-navy/10 bg-cream-soft">
        <table className="w-full text-left">
          <thead className="bg-navy text-cream">
            <tr>
              <th className="px-5 py-4 font-medium text-sm">Cancellation window</th>
              <th className="px-5 py-4 font-medium text-sm">Refund</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy/10">
            {tiers.map((t) => (
              <tr key={t.window} className="hover:bg-yellow/10 transition">
                <td className="px-5 py-4">
                  <p className="font-medium text-navy">{t.window}</p>
                  <p className="text-sm text-navy/60 mt-0.5">{t.note}</p>
                </td>
                <td className="px-5 py-4">
                  <span className="font-display text-2xl">{t.refund}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>2. How to Cancel</h2>
      <p>To cancel a booking, please reach out via either of these channels:</p>
      <ul>
        <li>Email <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a> with the subject line &ldquo;Cancellation — [Trip Name] — [Your Name]&rdquo;.</li>
        <li>WhatsApp us at {siteConfig.whatsapp} with your booking ID.</li>
      </ul>
      <p>
        We acknowledge cancellation requests within 24 hours. The cancellation date for refund calculation is the date your written request reaches us.
      </p>

      <h2>3. Refund Processing</h2>
      <p>
        Approved refunds are processed within <strong>7 business days</strong>, returned by the same route the payment reached us{paymentsConfig.gatewayLive ? " (UPI, card or net banking)" : " — the UPI ID or bank account the money came from"}. Depending on your bank, the credit may take an additional 2–5 business days to reflect.
      </p>
      <p>
        Refunds are issued in Indian Rupees (INR). Any third-party payment gateway charges, currency conversion fees or bank charges levied are non-refundable.
      </p>

      <h2>4. Trip Cancellation by {siteConfig.shortName}</h2>
      <p>
        If, for any reason, {siteConfig.name} cancels a trip — including but not limited to insufficient sign-ups, vendor failure, safety concerns, or natural events — we will offer travelers either:
      </p>
      <ul>
        <li>A <strong>full refund</strong> of all amounts paid, OR</li>
        <li>A <strong>credit voucher</strong> equal to 110% of the amount paid, valid for 12 months on any future trip.</li>
      </ul>
      <p>
        We will not be liable for any incidental costs (e.g. flights or trains booked separately by the traveler), so we recommend booking these only after we confirm trip departure 7 days before.
      </p>

      <h2>5. Force Majeure</h2>
      <p>
        In the event of force majeure — natural disasters, pandemics, government-imposed restrictions, civil unrest, transport strikes — that make the trip impossible or unsafe, we will work in good faith to either reschedule the trip, offer a credit voucher valid for 12 months, or provide a partial refund after deducting non-recoverable expenses already paid to vendors.
      </p>

      <h2>6. Trip Modification (Not Cancellation)</h2>
      <p>
        If we modify portions of the itinerary (route, stay, sightseeing) without materially shortening the trip duration or value, no refund is owed. We always communicate changes to confirmed travelers as soon as we know.
      </p>

      <h2>7. No-Show Policy</h2>
      <p>
        Failure to arrive at the trip&apos;s designated start point at the scheduled departure time is treated as a cancellation with no refund. The trip lead may, at their discretion, allow a late traveler to join the group later at the traveler&apos;s own cost.
      </p>

      <h2>8. Contact</h2>
      <p>
        For any clarifications about this policy or a specific booking, write to <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a> or visit our <a href="/contact-us">Contact Us</a> page.
      </p>
    </PolicyPageLayout>
  );
}
