"use client";

import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

import { updateNotificationPreferences } from "@/actions/account";
import { AccountSection } from "@/components/account/section";
import { PreferenceToggle } from "@/components/account/preference-toggle";
import { FormAlert, SubmitButton } from "@/components/auth";
import type { OnboardingCommsInput } from "@/lib/validation/onboarding";

export function NotificationForm({ initial }: { initial: OnboardingCommsInput }) {
  const [prefs, setPrefs] = useState(initial);

  const { execute, isPending, result } = useAction(updateNotificationPreferences, {
    onSuccess: () => toast.success("Preferences saved."),
    onError: ({ error }) =>
      toast.error(error.serverError ?? "Could not save your preferences"),
  });

  const set = <K extends keyof OnboardingCommsInput>(
    key: K,
    value: OnboardingCommsInput[K],
  ) => setPrefs((p) => ({ ...p, [key]: value }));

  return (
    <div className="space-y-6">
      <AccountSection
        title="Learning"
        description="Emails tied to work you're actually doing."
      >
        <div className="divide-y divide-border">
          <PreferenceToggle
            name="mentorFeedbackEmails"
            label="Mentor feedback"
            description="When a mentor reviews your submission or leaves a comment."
            checked={prefs.mentorFeedbackEmails}
            onCheckedChange={(v) => set("mentorFeedbackEmails", v)}
          />
          <PreferenceToggle
            name="cohortRemindersEmails"
            label="Cohort and session reminders"
            description="Live sessions starting, and deadlines coming up."
            checked={prefs.cohortRemindersEmails}
            onCheckedChange={(v) => set("cohortRemindersEmails", v)}
          />
          <PreferenceToggle
            name="productEmails"
            label="Product updates"
            description="Meaningful changes to how the platform works."
            checked={prefs.productEmails}
            onCheckedChange={(v) => set("productEmails", v)}
          />
        </div>
      </AccountSection>

      <AccountSection
        title="Marketing"
        description="Entirely optional, and off unless you say otherwise."
      >
        <div className="space-y-4">
          <PreferenceToggle
            name="marketingOptIn"
            label="New courses and offers"
            description="Occasional emails about new courses, cohorts and pricing."
            checked={prefs.marketingOptIn}
            onCheckedChange={(v) => set("marketingOptIn", v)}
          />
          <FormAlert tone="info">
            Security notices — password changes, new sign-ins, 2FA changes — are
            always sent. They&apos;re how you find out if something is wrong.
          </FormAlert>
        </div>
      </AccountSection>

      {result?.serverError ? <FormAlert>{result.serverError}</FormAlert> : null}

      <SubmitButton
        type="button"
        pending={isPending}
        pendingLabel="Saving…"
        className="w-auto px-8"
        onClick={() => execute(prefs)}
      >
        Save preferences
      </SubmitButton>
    </div>
  );
}
