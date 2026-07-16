import Link from "next/link";

import { LegalSection, LegalShell } from "@/components/marketing/legal-shell";
import { BRAND } from "@/lib/brand";

export const metadata = {
  title: "Refund & Cancellation Policy",
  description: `14-day guarded refund policy for ${BRAND.name} purchases.`,
};

export default function RefundPolicyPage() {
  return (
    <LegalShell
      title="Refund & Cancellation Policy"
      effectiveDate="17 July 2026"
    >
      <LegalSection heading="The short version">
        <p>
          Most purchases have a <strong>14-day refund window</strong> from the
          date of purchase. The window is guarded: it closes early once you
          have consumed a meaningful part of what you bought. Refunds are
          issued to the original payment method, with a GST credit note.
        </p>
      </LegalSection>

      <LegalSection heading="Courses (self-paced)">
        <ul>
          <li>Refundable within 14 days of purchase.</li>
          <li>
            Not refundable once <strong>more than 30%</strong> of the course is
            completed, or once a certificate has been issued — whichever comes
            first.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="Cohort seats (live programs)">
        <ul>
          <li>
            Refundable within 14 days of purchase, and only{" "}
            <strong>until the cohort starts</strong>.
          </li>
          <li>
            If we cancel or materially reschedule a cohort, you receive a full
            refund regardless of the window.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="Mentor-guided projects">
        <ul>
          <li>
            Refundable within 14 days of purchase, and only{" "}
            <strong>before your mentor kickoff</strong> takes place.
          </li>
          <li>
            After kickoff, mentor time has been committed on your behalf and
            the purchase is non-refundable.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="Subscriptions">
        <ul>
          <li>
            Cancel anytime from billing settings; access continues until the
            end of the paid period. Renewals are not refunded once charged —
            cancel before your renewal date.
          </li>
          <li>
            A first-time subscription charge is refundable within 14 days if
            you have not consumed subscription benefits (credits used,
            cohort seats claimed, or more than 30% of any included course).
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="How to request a refund">
        <p>
          Go to <strong>Orders → Request refund</strong> in your dashboard —
          eligibility is checked automatically against the rules above. Our
          team reviews requests within 3 business days. Approved refunds are
          returned to your original payment method, typically within 5–7
          business days depending on your bank, along with a credit note
          against the original tax invoice.
        </p>
      </LegalSection>

      <LegalSection heading="Exceptions">
        <p>
          We may refund outside these rules at our discretion (for example,
          duplicate payments, billing errors, or verified technical issues that
          prevented access). Fraudulent or abusive refund patterns (repeat
          purchase-consume-refund cycles) may result in refusal and account
          review. Questions? Reach us via the{" "}
          <Link href="/contact" className="underline underline-offset-4">
            contact page
          </Link>
          .
        </p>
      </LegalSection>
    </LegalShell>
  );
}
