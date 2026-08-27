"use client";

import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { completeOnboarding, saveOnboardingComms } from "@/actions/onboarding";
import { PreferenceToggle } from "@/components/account/preference-toggle";
import { AuthHeader, FormAlert, SubmitButton } from "@/components/auth";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";
import type { OnboardingCommsInput } from "@/lib/validation/onboarding";

export function CommsStep({
  initial,
  firstName,
}: {
  initial: OnboardingCommsInput;
  firstName: string;
}) {
  const router = useRouter();
  const [prefs, setPrefs] = useState(initial);

  const finish = useAction(completeOnboarding, {
    onSuccess: () => {
      toast.success(firstName ? `You're all set, ${firstName}.` : "You're all set.");
      router.push("/learn");
      router.refresh();
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Could not finish"),
  });

  const save = useAction(saveOnboardingComms, {
    // Two actions rather than one so the preferences are durable even if the
    // completion write fails — the user never has to re-answer.
    onSuccess: () => finish.execute({ skipped: false }),
    onError: ({ error }) =>
      toast.error(error.serverError ?? "Could not save your preferences"),
  });

  const pending = save.isPending || finish.isPending;

  const set = <K extends keyof OnboardingCommsInput>(
    key: K,
    value: OnboardingCommsInput[K],
  ) => setPrefs((p) => ({ ...p, [key]: value }));

  return (
    <FadeIn direction="up" duration={0.4}>
      <div className="space-y-6">
        <AuthHeader
          title="Last thing — what should we email you?"
          description="Change any of this later under Account. Nothing here is permanent."
        />

        <div className="divide-y divide-border rounded-2xl border border-border bg-card px-5">
          <PreferenceToggle
            name="mentorFeedbackEmails"
            label="Mentor feedback"
            description="When a mentor reviews your submission or leaves a comment."
            checked={prefs.mentorFeedbackEmails}
            onCheckedChange={(v) => set("mentorFeedbackEmails", v)}
          />
          <PreferenceToggle
            name="cohortRemindersEmails"
            label="Session and deadline reminders"
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
          <PreferenceToggle
            name="marketingOptIn"
            label="New courses and offers"
            description="Occasional. Off unless you turn it on."
            checked={prefs.marketingOptIn}
            onCheckedChange={(v) => set("marketingOptIn", v)}
          />
        </div>

        <FormAlert tone="info">
          Security notices — password changes, new sign-ins, 2FA changes — always
          send. They&apos;re how you find out if something is wrong.
        </FormAlert>

        <div className="flex gap-2">
          <SubmitButton
            type="button"
            pending={pending}
            pendingLabel="Finishing…"
            onClick={() => save.execute(prefs)}
          >
            Finish
          </SubmitButton>
          <Button
            type="button"
            variant="ghost"
            size="lg"
            className="rounded-full"
            disabled={pending}
            onClick={() => router.push("/welcome?step=goals")}
          >
            Back
          </Button>
        </div>
      </div>
    </FadeIn>
  );
}
