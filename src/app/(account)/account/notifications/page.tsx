import { AccountPageHeader } from "@/components/account/section";
import { getAccountProfile } from "@/lib/account/queries";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

import { NotificationForm } from "./notification-form";

export const metadata = { title: "Notifications" };

/** Everything on by default — the row only exists once someone changes something. */
const DEFAULTS = { product: true, mentorFeedback: true, cohortReminders: true };

export default async function AccountNotificationsPage() {
  const session = await requireUser("/account/notifications");
  const [profile, preference] = await Promise.all([
    getAccountProfile(),
    db.notificationPreference.findUnique({
      where: { userId: session.user.id },
      select: { prefs: true },
    }),
  ]);

  const stored = (preference?.prefs ?? {}) as Partial<typeof DEFAULTS>;

  return (
    <>
      <AccountPageHeader
        title="Notifications"
        description="What we email you about. Security notices always send — they're how you find out if something is wrong."
      />
      <NotificationForm
        initial={{
          marketingOptIn: profile.marketingOptIn,
          productEmails: stored.product ?? DEFAULTS.product,
          mentorFeedbackEmails: stored.mentorFeedback ?? DEFAULTS.mentorFeedback,
          cohortRemindersEmails: stored.cohortReminders ?? DEFAULTS.cohortReminders,
        }}
      />
    </>
  );
}
