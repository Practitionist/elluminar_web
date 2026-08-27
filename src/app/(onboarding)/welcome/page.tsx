import { redirect } from "next/navigation";

import { resolveStep } from "@/lib/onboarding/steps";
import { getInterestOptions, getOnboardingProgress } from "@/lib/onboarding/state";

import { CommsStep } from "./comms-step";
import { GoalsStep } from "./goals-step";
import { ProfileStep } from "./profile-step";
import { WizardProgress } from "./wizard-progress";

export const metadata = { title: "Welcome" };

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const [{ step: requestedStep }, progress] = await Promise.all([
    searchParams,
    getOnboardingProgress(),
  ]);

  // Already done and not deliberately revisiting a step — nothing to do here.
  if (progress.completed && !requestedStep) redirect("/learn");

  const step = resolveStep(requestedStep, progress);

  return (
    <div className="space-y-8">
      <WizardProgress
        current={step}
        completedSteps={progress.completedSteps}
        completed={progress.completed}
      />

      {step === "profile" ? (
        <ProfileStep
          initial={{
            name: progress.values.name,
            phone: progress.values.phone,
            timezone: progress.values.timezone,
            locale: progress.values.locale,
          }}
        />
      ) : null}

      {step === "goals" ? (
        <GoalsStep
          interests={await getInterestOptions()}
          initial={{
            goal: progress.values.goal,
            experienceLevel: progress.values.experienceLevel,
            interests: progress.values.interests,
            headline: progress.values.headline,
          }}
        />
      ) : null}

      {step === "comms" ? (
        <CommsStep
          initial={{
            marketingOptIn: progress.values.marketingOptIn,
            productEmails: progress.values.productEmails,
            mentorFeedbackEmails: progress.values.mentorFeedbackEmails,
            cohortRemindersEmails: progress.values.cohortRemindersEmails,
          }}
          firstName={progress.values.name.split(" ")[0] ?? ""}
        />
      ) : null}
    </div>
  );
}
