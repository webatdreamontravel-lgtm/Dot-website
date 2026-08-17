import type { Metadata } from "next";
import { PolicyPageLayout } from "@/components/shared/PolicyPageLayout";
import { siteConfig } from "@/lib/data/siteConfig";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${siteConfig.name} collects, uses, and protects your information.`,
};

export default function PrivacyPage() {
  return (
    <PolicyPageLayout title="Privacy Policy" kicker="Your data, our promise">
      <p>
        {siteConfig.name} (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) respects your privacy. This Privacy Policy explains what information we collect when you use <a href={siteConfig.url}>{siteConfig.url}</a> or book a trip with us, how we use it, and the choices you have.
      </p>

      <h2>1. Information We Collect</h2>
      <p>To deliver our services we may collect:</p>
      <ul>
        <li><strong>Identity information</strong> — full name, age, gender, date of birth.</li>
        <li><strong>Contact information</strong> — email address, phone number, WhatsApp number, residential city.</li>
        <li><strong>Travel-specific information</strong> — passport details (for international trips), dietary preferences, medical conditions relevant to safety, emergency contact.</li>
        <li><strong>Booking information</strong> — trip selected, traveler companions, slot booked.</li>
        <li><strong>Payment metadata</strong> — payment method type and transaction reference. We do <strong>not</strong> store your card or banking details ourselves.</li>
        <li><strong>Technical information</strong> — IP address, browser type, pages visited, time spent (used for analytics and to improve the website).</li>
      </ul>

      <h2>2. How We Use Your Information</h2>
      <ul>
        <li>To process bookings, issue confirmations and travel vouchers.</li>
        <li>To communicate with you about your trip via email, phone, and WhatsApp.</li>
        <li>To facilitate trip-specific WhatsApp groups with co-travelers (only after explicit consent).</li>
        <li>To meet legal, regulatory and tax obligations.</li>
        <li>To send you trip drops, offers and community updates — only if you opt in.</li>
        <li>To improve our website, products, and services.</li>
      </ul>

      <h2>3. Data Sharing</h2>
      <p>We share your information only with:</p>
      <ul>
        <li><strong>Razorpay</strong> — our payment partner, for processing transactions securely.</li>
        <li><strong>Service providers</strong> — accommodation, transport, activity vendors and visa-on-arrival partners, who require traveler details to deliver your booking.</li>
        <li><strong>Government authorities</strong> — if required by law (e.g. police, courts, tax authorities).</li>
      </ul>
      <p>
        We do not sell your personal information to advertisers, data brokers, or any third party.
      </p>

      <h2>4. Cookies & Analytics</h2>
      <p>
        We use minimal cookies necessary for the site to function and basic analytics to understand traffic. You can disable cookies in your browser settings; some site functionality may break as a result.
      </p>

      <h2>5. Data Retention</h2>
      <p>
        We retain personal information only as long as necessary to fulfill the purposes for which it was collected, including legal, accounting or reporting requirements. Booking records are typically retained for 7 years to comply with Indian tax law.
      </p>

      <h2>6. Your Rights</h2>
      <p>You have the right to:</p>
      <ul>
        <li><strong>Access</strong> a copy of the personal information we hold about you.</li>
        <li><strong>Correct</strong> inaccurate or outdated information.</li>
        <li><strong>Delete</strong> your information, subject to legal retention requirements.</li>
        <li><strong>Opt out</strong> of marketing communications at any time.</li>
        <li><strong>Withdraw consent</strong> for processing where consent was the basis.</li>
      </ul>
      <p>
        To exercise any of these rights, email <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>. We respond within 30 days.
      </p>

      <h2>7. Data Security</h2>
      <p>
        We use industry-standard practices to protect your information — HTTPS for all transmission, access controls on our systems, and PCI-compliant payment processing through Razorpay. No system is 100% secure, but we take security seriously and notify users of material breaches as required by law.
      </p>

      <h2>8. Children&apos;s Privacy</h2>
      <p>
        Our services are not directed to children under 18. For our Mom &amp; Kutties trips, all booking and payment is done by the parent/guardian on behalf of the child. We collect minimal information about minor travelers and only what is needed for safety and travel.
      </p>

      <h2>9. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. The latest version will always be available at this URL with an updated date. Material changes will be communicated to active customers via email.
      </p>

      <h2>10. Contact</h2>
      <p>
        Questions or concerns? Email <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>, WhatsApp {siteConfig.whatsapp}, or visit our <a href="/contact-us">Contact Us</a> page.
      </p>
    </PolicyPageLayout>
  );
}
