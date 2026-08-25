import { LegalSection, LegalShell } from "@/components/marketing/legal-shell";
import { BRAND } from "@/lib/brand";

export const metadata = {
  title: "Contact Us",
  description: `Support, grievance, and business contact details for ${BRAND.name}.`,
};

export default function ContactPage() {
  return (
    <LegalShell title="Contact Us" effectiveDate="17 July 2026">
      <LegalSection heading="Support">
        <p>
          For help with your account, purchases, courses, or projects, email{" "}
          <a
            href={`mailto:${BRAND.supportEmail}`}
            className="underline underline-offset-4"
          >
            {BRAND.supportEmail}
          </a>
          . We respond within 1 business day.
        </p>
      </LegalSection>

      <LegalSection heading="Refunds and billing">
        <p>
          Refund requests are made from <strong>Orders → Request refund</strong>{" "}
          in your dashboard (see the refund policy for eligibility). For billing
          questions or invoice corrections, email{" "}
          <a
            href={`mailto:${BRAND.supportEmail}`}
            className="underline underline-offset-4"
          >
            {BRAND.supportEmail}
          </a>{" "}
          with your order ID.
        </p>
      </LegalSection>

      <LegalSection heading="Grievance officer">
        <p>
          Complaints under the Information Technology Act, the Consumer
          Protection (E-Commerce) Rules, or the DPDP Act, 2023 — including
          content takedown and data-rights requests — may be addressed to the
          Grievance Officer at{" "}
          <a
            href={`mailto:${BRAND.grievanceEmail}`}
            className="underline underline-offset-4"
          >
            {BRAND.grievanceEmail}
          </a>
          . We acknowledge within 48 hours.
        </p>
      </LegalSection>

      <LegalSection heading="Registered office">
        <p>
          {BRAND.legalEntity}
          <br />
          {BRAND.registeredAddress}
        </p>
      </LegalSection>

      <LegalSection heading="Creators, mentors, and partnerships">
        <p>
          Want to publish courses, mentor projects, or hire from our verified
          talent pool? Email{" "}
          <a
            href={`mailto:${BRAND.supportEmail}`}
            className="underline underline-offset-4"
          >
            {BRAND.supportEmail}
          </a>{" "}
          with the subject &ldquo;Creator&rdquo;, &ldquo;Mentor&rdquo;, or
          &ldquo;Hiring partner&rdquo;.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
