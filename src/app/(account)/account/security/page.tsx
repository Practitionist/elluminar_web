import { AccountPageHeader } from "@/components/account/section";
import { getAccountProfile, getLinkedAccounts } from "@/lib/account/queries";

import { ChangeEmailForm } from "./change-email-form";
import { ChangePasswordForm } from "./change-password-form";
import { TwoFactorPanel } from "./two-factor-panel";

export const metadata = { title: "Security" };

export default async function AccountSecurityPage() {
  const [profile, accounts] = await Promise.all([
    getAccountProfile(),
    getLinkedAccounts(),
  ]);

  // No `credential` account means this user only ever signed in through Google
  // or SSO — there is no existing password to ask them for.
  const hasPassword = accounts.some((a) => a.provider === "credential");

  return (
    <>
      <AccountPageHeader
        title="Security"
        description="Your password, two-factor authentication, and the address you sign in with."
      />
      <div className="space-y-6">
        <TwoFactorPanel enabled={profile.twoFactorEnabled} hasPassword={hasPassword} />
        <ChangePasswordForm hasPassword={hasPassword} />
        <ChangeEmailForm currentEmail={profile.email} />
      </div>
    </>
  );
}
