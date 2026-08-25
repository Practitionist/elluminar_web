import Link from "next/link";

import { LegalSection, LegalShell } from "@/components/marketing/legal-shell";
import { BRAND } from "@/lib/brand";

export const metadata = {
  title: "Terms of Service",
  description: `Terms of Service for ${BRAND.name}.`,
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" effectiveDate="17 July 2026">
      <LegalSection heading="1. Who we are">
        <p>
          {BRAND.legalEntity} (&ldquo;{BRAND.name}&rdquo;, &ldquo;we&rdquo;,
          &ldquo;us&rdquo;) operates an online learning and project-completion
          platform where independent creators and mentors publish courses,
          cohorts, and mentor-guided projects, and learners purchase and
          complete them. These Terms govern your use of the platform. By
          creating an account or making a purchase, you agree to them.
        </p>
      </LegalSection>

      <LegalSection heading="2. Accounts">
        <p>
          You must provide accurate information when registering and keep your
          credentials secure. You are responsible for activity under your
          account. You must be at least 18, or use the platform under the
          supervision of a parent or guardian who accepts these Terms. We may
          suspend accounts that violate these Terms, our policies, or
          applicable law.
        </p>
      </LegalSection>

      <LegalSection heading="3. Purchases, pricing, and taxes">
        <p>
          Prices are displayed in Indian Rupees (INR) and are inclusive of
          applicable GST unless stated otherwise. Payments are processed by our
          payment partners (currently Razorpay). Subscriptions renew
          automatically at the stated interval until cancelled; you can cancel
          anytime from your billing settings, effective at the end of the
          current billing period. A tax invoice is issued for every order.
        </p>
      </LegalSection>

      <LegalSection heading="4. Refunds">
        <p>
          Refunds are governed by our{" "}
          <Link href="/refund-policy" className="underline underline-offset-4">
            Refund Policy
          </Link>
          , which offers a 14-day guarded refund window on most purchases. The
          Refund Policy is part of these Terms.
        </p>
      </LegalSection>

      <LegalSection heading="5. Content and licenses">
        <p>
          Course and project content belongs to the creators who publish it (or
          their licensors). Your purchase grants you a personal,
          non-transferable, non-exclusive license to access the content for
          your own learning. You may not record, re-distribute, resell, or
          publicly share paid content. Work you produce in projects
          (repositories, submissions, portfolio artifacts) remains yours; you
          grant us a license to host, display, and — where you opt in — publish
          it on your public portfolio and share it with hiring partners.
        </p>
      </LegalSection>

      <LegalSection heading="6. Credentials and integrity">
        <p>
          Credentials we issue reflect verified completion, including mentor
          review and, where applicable, a live project defense. We may withhold
          or revoke a credential where we find plagiarism, impersonation,
          undisclosed AI-generated submissions presented as your own work, or
          other integrity violations. Revoked credentials are reflected on the
          public verification page.
        </p>
      </LegalSection>

      <LegalSection heading="7. Acceptable use">
        <ul>
          <li>No unlawful, infringing, or fraudulent activity.</li>
          <li>No harassment or abuse of learners, creators, or mentors.</li>
          <li>
            No scraping, reverse engineering, or circumventing access controls,
            drip schedules, or paywalls.
          </li>
          <li>No sharing of accounts or purchased content.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="8. Creators and mentors">
        <p>
          Creators and mentors are independent parties, not our employees.
          Separate marketplace agreements govern revenue share, payouts, and
          conduct. We moderate published content and may remove content that
          violates law or policy; takedown requests can be sent to{" "}
          <a
            href={`mailto:${BRAND.grievanceEmail}`}
            className="underline underline-offset-4"
          >
            {BRAND.grievanceEmail}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection heading="9. Disclaimers and liability">
        <p>
          The platform is provided &ldquo;as is&rdquo;. We do not guarantee
          employment outcomes, salary changes, or placement. To the maximum
          extent permitted by law, our aggregate liability for any claim is
          limited to the amount you paid us in the 12 months preceding the
          claim. Nothing in these Terms limits liability that cannot be limited
          under Indian law.
        </p>
      </LegalSection>

      <LegalSection heading="10. Governing law and disputes">
        <p>
          These Terms are governed by the laws of India. Courts at our
          registered place of business have exclusive jurisdiction, subject to
          any mandatory consumer-protection rights you hold.
        </p>
      </LegalSection>

      <LegalSection heading="11. Grievance officer">
        <p>
          In accordance with Indian law, complaints may be addressed to our
          Grievance Officer at{" "}
          <a
            href={`mailto:${BRAND.grievanceEmail}`}
            className="underline underline-offset-4"
          >
            {BRAND.grievanceEmail}
          </a>
          . We acknowledge complaints within 48 hours and resolve them within
          the timelines prescribed by applicable rules.
        </p>
      </LegalSection>

      <LegalSection heading="12. Changes">
        <p>
          We may update these Terms. Material changes will be notified by email
          or in-app notice at least 7 days before they take effect. Continued
          use after the effective date constitutes acceptance.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
