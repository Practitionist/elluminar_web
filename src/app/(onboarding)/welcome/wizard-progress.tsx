import { Check } from "lucide-react";
import Link from "next/link";

import { ONBOARDING_STEPS, type OnboardingStep } from "@/lib/validation/onboarding";
import { cn } from "@/lib/utils";

const LABELS: Record<OnboardingStep, string> = {
  profile: "About you",
  goals: "Your goals",
  comms: "Staying in touch",
};

export function WizardProgress({
  current,
  completedSteps,
  completed,
}: {
  current: OnboardingStep;
  completedSteps: OnboardingStep[];
  completed: boolean;
}) {
  const currentIndex = ONBOARDING_STEPS.indexOf(current);

  return (
    <nav aria-label="Onboarding progress">
      <ol className="flex items-center gap-2">
        {ONBOARDING_STEPS.map((step, i) => {
          const isDone = completedSteps.includes(step);
          const isCurrent = step === current;
          // Only completed steps are navigable — jumping ahead would show a
          // step whose defaults depend on answers that don't exist yet.
          const canVisit = isDone || completed;

          const dot = (
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
                isCurrent
                  ? "bg-primary text-primary-foreground"
                  : isDone
                    ? "bg-success-subtle text-success-subtle-foreground"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {isDone && !isCurrent ? <Check className="size-3.5" /> : i + 1}
            </span>
          );

          return (
            <li key={step} className="flex flex-1 items-center gap-2">
              {canVisit && !isCurrent ? (
                <Link
                  href={`/welcome?step=${step}`}
                  className="flex items-center gap-2 rounded-full transition-opacity hover:opacity-80"
                >
                  {dot}
                  <span className="hidden text-xs font-medium sm:inline">
                    {LABELS[step]}
                  </span>
                </Link>
              ) : (
                <span className="flex items-center gap-2">
                  {dot}
                  <span
                    className={cn(
                      "hidden text-xs font-medium sm:inline",
                      isCurrent ? "text-foreground" : "text-muted-foreground",
                    )}
                    aria-current={isCurrent ? "step" : undefined}
                  >
                    {LABELS[step]}
                  </span>
                </span>
              )}

              {i < ONBOARDING_STEPS.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-px flex-1 transition-colors",
                    i < currentIndex ? "bg-primary/40" : "bg-border",
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
