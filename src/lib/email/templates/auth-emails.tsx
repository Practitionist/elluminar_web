import { BRAND } from "@/lib/brand";

import {
  EmailButton,
  EmailFallbackLink,
  EmailLayout,
  EmailParagraph,
} from "./layout";

/**
 * Transactional auth emails. Each one names the action, gives one button, and
 * says what to do if the recipient did not ask for it — the last part matters
 * most, because these are exactly the emails an attacker triggers.
 */

export function VerifyEmail({ name, url }: { name: string; url: string }) {
  return (
    <EmailLayout
      preview={`Confirm your email to activate your ${BRAND.name} account`}
      heading="Confirm your email"
      footNote="This link expires in one hour and can be used once."
    >
      <EmailParagraph>Hi {name},</EmailParagraph>
      <EmailParagraph>
        Confirm this address to activate your account and start learning.
      </EmailParagraph>
      <EmailButton href={url}>Confirm email</EmailButton>
      <EmailParagraph>
        If you didn&apos;t create an account, you can ignore this — nothing
        happens until the link is used.
      </EmailParagraph>
      <EmailFallbackLink href={url} />
    </EmailLayout>
  );
}

export function ResetPasswordEmail({ name, url }: { name: string; url: string }) {
  return (
    <EmailLayout
      preview={`Reset your ${BRAND.name} password`}
      heading="Reset your password"
      footNote="This link expires in one hour and can be used once."
    >
      <EmailParagraph>Hi {name},</EmailParagraph>
      <EmailParagraph>
        Someone asked to reset the password on this account. If it was you,
        choose a new one:
      </EmailParagraph>
      <EmailButton href={url}>Choose a new password</EmailButton>
      <EmailParagraph>
        If it wasn&apos;t you, ignore this email — your password has not
        changed, and the link stops working once it expires.
      </EmailParagraph>
      <EmailFallbackLink href={url} />
    </EmailLayout>
  );
}

export function ChangeEmailConfirmation({
  name,
  newEmail,
  url,
}: {
  name: string;
  newEmail: string;
  url: string;
}) {
  return (
    <EmailLayout
      preview="Approve the new email address on your account"
      heading="Approve your new email address"
      footNote="Sent to your current address on purpose, so an unauthorized change is visible to you."
    >
      <EmailParagraph>Hi {name},</EmailParagraph>
      <EmailParagraph>
        Someone asked to change this account&apos;s email to{" "}
        <strong>{newEmail}</strong>. The change only takes effect if you approve
        it here:
      </EmailParagraph>
      <EmailButton href={url}>Approve the change</EmailButton>
      <EmailParagraph>
        <strong>If this wasn&apos;t you, do not click the link.</strong> Someone
        may have access to your account — change your password immediately.
      </EmailParagraph>
      <EmailFallbackLink href={url} />
    </EmailLayout>
  );
}

export function OrganizationInvitation({
  organizationName,
  inviterName,
  url,
}: {
  organizationName: string;
  inviterName: string;
  url: string;
}) {
  return (
    <EmailLayout
      preview={`${inviterName} invited you to join ${organizationName}`}
      heading={`Join ${organizationName}`}
      footNote="This invitation expires in 72 hours."
    >
      <EmailParagraph>
        <strong>{inviterName}</strong> invited you to join{" "}
        <strong>{organizationName}</strong> on {BRAND.name}.
      </EmailParagraph>
      <EmailParagraph>
        You&apos;ll see which role you&apos;re being given, and what it lets you
        do, before you accept anything.
      </EmailParagraph>
      <EmailButton href={url}>Review the invitation</EmailButton>
      <EmailParagraph>
        Not expecting this? Ignore it — nothing is added to your account unless
        you accept.
      </EmailParagraph>
      <EmailFallbackLink href={url} />
    </EmailLayout>
  );
}
