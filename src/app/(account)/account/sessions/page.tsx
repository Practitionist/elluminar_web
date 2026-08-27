import { AccountPageHeader } from "@/components/account/section";
import { describeDevice, getAccountSessions } from "@/lib/account/queries";

import { SessionList } from "./session-list";

export const metadata = { title: "Devices" };

export default async function AccountSessionsPage() {
  const sessions = await getAccountSessions();

  return (
    <>
      <AccountPageHeader
        title="Devices"
        description="Everywhere you're currently signed in. Revoke anything you don't recognise."
      />
      <SessionList
        sessions={sessions.map((s) => ({
          token: s.token,
          device: describeDevice(s.userAgent),
          ipAddress: s.ipAddress,
          lastActive: s.updatedAt.toISOString(),
          signedInAt: s.createdAt.toISOString(),
          isCurrent: s.isCurrent,
        }))}
      />
    </>
  );
}
