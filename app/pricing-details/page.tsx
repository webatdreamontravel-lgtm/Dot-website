import type { Metadata } from "next";
import { PolicyPageLayout } from "@/components/shared/PolicyPageLayout";
import { siteConfig } from "@/lib/data/siteConfig";

export const metadata: Metadata = {
  title: "Pricing Details",
  description: `How ${siteConfig.name} prices its trips — currency, taxes, advance amounts, and what's included.`,
};

export default function PricingPage() {
  return (
    <PolicyPageLayout title="Pricing Details" kicker="What you pay & why">
      <h2>Currency</h2>
      <p>
        All prices on the {siteConfig.name} website and in invoices are listed in <strong>Indian Rupees (INR / ₹)</strong>. International payments are converted at the prevailing exchange rate by your card issuer or bank — {siteConfig.name} does not charge any currency conversion fee.
      </p>

      <h2>Taxes</h2>
      <p>
        Trip prices on each trip detail page are shown <strong>exclusive of GST</strong>. The applicable GST rate (typically 5% for tour operator services under Indian law) is added at checkout and clearly displayed before payment.
      </p>
      <p>
        A tax invoice is issued for every booking after full payment is received and is delivered to the email address on file.
      </p>

      <h2>Advance & Balance Payment</h2>
      <p>
        Each trip lists an <strong>advance amount</strong> required to confirm a slot. This is non-negotiable and varies by trip duration and destination. For most domestic trips, the advance ranges from ₹3,500 to ₹5,000. For international trips, it ranges from ₹15,000 to ₹25,000.
      </p>
      <p>
        The remaining balance is collected in one or two installments, depending on the trip:
      </p>
      <ul>
        <li>For domestic trips — full balance due 15 days before departure.</li>
        <li>For international trips — typically split: 50% due 60 days before departure, balance 30 days before.</li>
      </ul>
      <p>
        Failure to pay balance amounts by the communicated dates may result in cancellation per our <a href="/cancellation-and-refund-policy">Cancellation Policy</a>.
      </p>

      <h2>What&apos;s Included in Trip Prices</h2>
      <p>Each trip detail page lists exact inclusions. As a general rule, our prices include:</p>
      <ul>
        <li>Accommodation as specified for the duration of the trip.</li>
        <li>Ground transportation between cities and at the destination.</li>
        <li>Sightseeing and activities listed in the itinerary.</li>
        <li>Meals as specified in the itinerary (typically all breakfasts, select dinners).</li>
        <li>Entry tickets, permits and government taxes for activities listed.</li>
        <li>An experienced trip lead throughout the trip.</li>
        <li>Access to a private trip WhatsApp group.</li>
      </ul>

      <h2>What&apos;s Not Included</h2>
      <ul>
        <li>Travel from your home city to the trip&apos;s designated start point (we do help coordinate group bookings).</li>
        <li>Meals not specifically mentioned in the inclusions list.</li>
        <li>Personal expenses, alcoholic beverages, optional activities and tips.</li>
        <li>Travel insurance (mandatory for abroad trips, recommended for domestic).</li>
        <li>Visa fees and visa-on-arrival fees for international trips.</li>
        <li>Anything not explicitly listed as included.</li>
      </ul>

      <h2>Payment Methods</h2>
      <p>We accept payments through Razorpay, supporting:</p>
      <ul>
        <li><strong>UPI</strong> — Google Pay, PhonePe, Paytm, BHIM and any UPI app.</li>
        <li><strong>Debit & Credit cards</strong> — Visa, MasterCard, Rupay, American Express.</li>
        <li><strong>Net banking</strong> — All major Indian banks.</li>
        <li><strong>EMI</strong> — Available on select credit cards (subject to bank approval).</li>
      </ul>
      <p>
        For privacy and security, {siteConfig.name} does not store any card or banking information. Transactions are processed by Razorpay over secure, PCI-compliant infrastructure.
      </p>

      <h2>Group Discounts</h2>
      <p>
        Booking 4 or more people together on a single domestic trip qualifies for a 5% group discount, applied at the time of payment. Discounts cannot be combined with promotional offers.
      </p>

      <h2>Promotional Offers</h2>
      <p>
        Any seasonal offers, early-bird pricing, or referral discounts are listed on the specific trip page and are time-limited. Offers cannot be applied retroactively to existing bookings.
      </p>

      <h2>Price Changes</h2>
      <p>
        Once a trip is booked and the advance is paid, the trip price for that booking is locked. Any future price changes (typically only for new sign-ups) do not affect already-confirmed travelers.
      </p>

      <h2>Contact</h2>
      <p>
        Have a pricing question? Email <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a> or WhatsApp us at {siteConfig.whatsapp}.
      </p>
    </PolicyPageLayout>
  );
}
