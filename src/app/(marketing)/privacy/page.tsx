import Link from "next/link";

import { LegalSection, LegalShell } from "@/components/marketing/legal-shell";
import { BRAND } from "@/lib/brand";

export const metadata = {
  title: "Privacy Policy",
  description: `Privacy Policy for ${BRAND.name} — how we collect, use, and protect your personal data under the DPDP Act, 2023.`,
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" effectiveDate="17 July 2026">
      <LegalSection heading="1. Scope">
        <p>
          This policy explains how {BRAND.legalEntity} (&ldquo;{BRAND.name}
          &rdquo;) processes personal data as a Data Fiduciary under
          India&rsquo;s Digital Personal Data Protection Act, 2023 (DPDP Act),
          and other applicable law. It covers learners, creators, mentors, and
          visitors.
        </p>
      </LegalSection>

      <LegalSection heading="2. What we collect">
        <ul>
          <li>
            <strong>Account data</strong> — name, email, phone (optional),
            password hash, profile details, timezone.
          </li>
          <li>
            <strong>Learning data</strong> — enrollments, lesson progress, quiz
            attempts, project submissions, mentor reviews, credentials.
          </li>
          <li>
            <strong>Commerce data</strong> — orders, invoices, subscription
            status, refund requests. Card and banking details are processed by
            our payment partner (Razorpay) and never stored by us.
          </li>
          <li>
            <strong>Technical data</strong> — device and log information,
            cookies (see section 7), and error diagnostics.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. Why we process it">
        <p>
          We process personal data to provide the service you signed up for
          (contract), with your consent where required (e.g., marketing
          communications, public portfolios, talent-pool visibility), and to
          meet legal obligations (tax invoices, accounting records). We do not
          sell personal data.
        </p>
      </LegalSection>

      <LegalSection heading="4. Who we share it with">
        <ul>
          <li>
            <strong>Processors</strong> — Supabase (database and storage),
            Razorpay (payments), Fermion (video, live classes, code labs),
            Resend (transactional email), Sentry (error monitoring), Netlify
            (hosting). Each processes data under contract, only on our
            instructions.
          </li>
          <li>
            <strong>Creators and mentors</strong> — see your progress and
            submissions for content you enrolled in with them.
          </li>
          <li>
            <strong>Public, only if you opt in</strong> — portfolio pages,
            credential verification pages, and hiring-partner visibility are
            consent-first and controllable from your settings.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="5. Your rights (DPDP Act)">
        <p>
          You may access, correct, and update your data from your account
          settings, withdraw consent for optional processing, nominate a
          person to exercise rights on your behalf, and request erasure.
          Erasure is implemented as anonymization: your personal identifiers
          are irreversibly overwritten while non-personal records we must
          retain (e.g., tax invoices) are kept as law requires. To exercise any
          right, write to{" "}
          <a
            href={`mailto:${BRAND.grievanceEmail}`}
            className="underline underline-offset-4"
          >
            {BRAND.grievanceEmail}
          </a>
          . If unsatisfied, you may escalate to the Data Protection Board of
          India.
        </p>
      </LegalSection>

      <LegalSection heading="6. Retention">
        <p>
          Account and learning data is retained while your account is active
          and for up to 90 days after a deletion request completes processing.
          Financial records (orders, invoices, ledgers) are retained for 8
          years as required by Indian tax and company law, dissociated from
          your identity after anonymization.
        </p>
      </LegalSection>

      <LegalSection heading="7. Cookies">
        <p>
          We use strictly necessary cookies for sign-in sessions and cart
          state. Optional analytics cookies are set only after you consent via
          the cookie banner, and you can change your choice anytime from the
          banner settings. We do not use third-party advertising cookies.
        </p>
      </LegalSection>

      <LegalSection heading="8. Security">
        <p>
          Data is encrypted in transit, access is role-restricted, payments are
          handled by PCI-DSS-compliant partners, and we maintain audit logs on
          administrative actions. No system is perfectly secure; we notify
          affected users and the Data Protection Board of breaches as the DPDP
          Act requires.
        </p>
      </LegalSection>

      <LegalSection heading="9. Children">
        <p>
          The platform is not directed at children under 18. Where a minor uses
          the platform, verifiable parental consent is required and we do not
          serve behavioral advertising to minors.
        </p>
      </LegalSection>

      <LegalSection heading="10. Contact and changes">
        <p>
          Grievance Officer:{" "}
          <a
            href={`mailto:${BRAND.grievanceEmail}`}
            className="underline underline-offset-4"
          >
            {BRAND.grievanceEmail}
          </a>{" "}
          ·{" "}
          <Link href="/contact" className="underline underline-offset-4">
            all contact details
          </Link>
          . We will notify you of material changes to this policy before they
          take effect.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
