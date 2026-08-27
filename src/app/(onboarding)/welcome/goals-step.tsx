"use client";

import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { saveOnboardingGoals } from "@/actions/onboarding";
import { AuthHeader, FormAlert, SubmitButton, TextField } from "@/components/auth";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { fieldErrors, formError } from "@/lib/form-errors";
import { cn } from "@/lib/utils";
import { EXPERIENCE_LEVELS, LEARNING_GOALS } from "@/lib/validation/onboarding";

const MAX_INTERESTS = 8;

export function GoalsStep({
  interests,
  initial,
}: {
  interests: { slug: string; name: string; icon: string | null }[];
  initial: {
    goal: string | null;
    experienceLevel: string | null;
    interests: string[];
    headline: string;
  };
}) {
  const router = useRouter();
  const [goal, setGoal] = useState(initial.goal);
  const [level, setLevel] = useState(initial.experienceLevel);
  const [selected, setSelected] = useState<string[]>(initial.interests);

  const { execute, isPending, result } = useAction(saveOnboardingGoals, {
    onSuccess: () => router.push("/welcome?step=comms"),
    onError: ({ error }) => {
      if (!error.validationErrors) {
        toast.error(error.serverError ?? "Could not save that");
      }
    },
  });

  const errors = fieldErrors(result?.validationErrors);
  const topLevelError = formError(result?.validationErrors) ?? result?.serverError;

  function toggleInterest(slug: string) {
    setSelected((prev) =>
      prev.includes(slug)
        ? prev.filter((s) => s !== slug)
        : prev.length >= MAX_INTERESTS
          ? prev
          : [...prev, slug],
    );
  }

  return (
    <FadeIn direction="up" duration={0.4}>
      <div className="space-y-6">
        <AuthHeader
          title="What are you here to do?"
          description="This shapes what we put in front of you. None of it is locked in."
        />

        {topLevelError ? <FormAlert>{topLevelError}</FormAlert> : null}

        <form
          className="space-y-6"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            execute({
              goal: goal ?? "",
              experienceLevel: level ?? "",
              interests: selected,
              headline: String(form.get("headline") ?? ""),
            });
          }}
        >
          <fieldset className="space-y-2">
            <legend className="text-sm leading-none font-medium">
              Your main goal
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {LEARNING_GOALS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  aria-pressed={goal === g.value}
                  onClick={() => setGoal(g.value)}
                  className={cn(
                    "rounded-xl border p-3 text-left text-sm font-medium transition-colors",
                    goal === g.value
                      ? "border-2 border-primary bg-primary-subtle text-primary-subtle-foreground"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>
            {errors.goal ? (
              <p className="text-xs font-medium text-destructive" aria-live="polite">
                {errors.goal}
              </p>
            ) : null}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm leading-none font-medium">
              Where you are today
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {EXPERIENCE_LEVELS.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  aria-pressed={level === l.value}
                  onClick={() => setLevel(l.value)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors",
                    level === l.value
                      ? "border-2 border-primary bg-primary-subtle"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  <span className="block text-sm font-medium">{l.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {l.hint}
                  </span>
                </button>
              ))}
            </div>
            {errors.experienceLevel ? (
              <p className="text-xs font-medium text-destructive" aria-live="polite">
                {errors.experienceLevel}
              </p>
            ) : null}
          </fieldset>

          <Field name="interests" error={errors.interests}>
            <FieldLabel>What you want to work on</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {interests.map((c) => {
                const isOn = selected.includes(c.slug);
                return (
                  <button
                    key={c.slug}
                    type="button"
                    aria-pressed={isOn}
                    onClick={() => toggleInterest(c.slug)}
                    disabled={!isOn && selected.length >= MAX_INTERESTS}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                      isOn
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-primary/40 disabled:opacity-40",
                    )}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
            <FieldDescription>
              {selected.length} of {MAX_INTERESTS} selected.
            </FieldDescription>
          </Field>

          <TextField
            name="headline"
            label="One line about you"
            error={errors.headline}
            description="Optional. Appears on your portfolio when you publish it."
            inputProps={{
              defaultValue: initial.headline,
              maxLength: 120,
              placeholder: "Backend engineer moving into distributed systems",
            }}
          />

          <div className="flex gap-2">
            <SubmitButton pending={isPending} pendingLabel="Saving…">
              Continue
            </SubmitButton>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              className="rounded-full"
              onClick={() => router.push("/welcome?step=profile")}
            >
              Back
            </Button>
          </div>
        </form>
      </div>
    </FadeIn>
  );
}
