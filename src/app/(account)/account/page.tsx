import { AccountPageHeader } from "@/components/account/section";
import { getAccountProfile } from "@/lib/account/queries";

import { ProfileForm } from "./profile-form";

export const metadata = { title: "Profile" };

export default async function AccountProfilePage() {
  const profile = await getAccountProfile();

  return (
    <>
      <AccountPageHeader
        title="Profile"
        description="How you appear to mentors and to anyone reviewing your work."
      />
      <ProfileForm
        initial={{
          name: profile.name,
          phone: profile.phone ?? "",
          timezone: profile.timezone,
          locale: profile.locale === "hi" ? "hi" : "en",
        }}
        email={profile.email}
        emailVerified={profile.emailVerified}
        memberSince={profile.createdAt}
      />
    </>
  );
}
