"use client";

import { Phone, User } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { saveOnboardingProfile } from "@/actions/onboarding";
import { TimezoneField } from "@/components/account/timezone-field";
import { AuthHeader, FormAlert, SubmitButton, TextField } from "@/components/auth";
import { FadeIn } from "@/components/ui/fade-in";
import { Field, FieldControl, FieldLabel } from "@/components/ui/field";
import { fieldErrors, formError } from "@/lib/form-errors";
import type { OnboardingProfileInput } from "@/lib/validation/onboarding";

import { SkipLink } from "./skip-link";

export function ProfileStep({ initial }: { initial: OnboardingProfileInput }) {
  const router = useRouter();

  const { execute, isPending, result } = useAction(saveOnboardingProfile, {
    onSuccess: () => router.push("/welcome?step=goals"),
    onError: ({ error }) => {
      if (!error.validationErrors) {
        toast.error(error.serverError ?? "Could not save that");
      }
    },
  });

  const errors = fieldErrors(result?.validationErrors);
  const topLevelError = formError(result?.validationErrors) ?? result?.serverError;

  return (
    <FadeIn direction="up" duration={0.4}>
      <div className="space-y-6">
        <AuthHeader
          title="First, the basics"
          description="Mentors see your name on the work they review, and your timezone decides when we send session reminders."
        />

        {topLevelError ? <FormAlert>{topLevelError}</FormAlert> : null}

        <form
          className="space-y-5"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            execute({
              name: String(form.get("name") ?? ""),
              phone: String(form.get("phone") ?? ""),
              timezone: String(form.get("timezone") ?? ""),
              locale: String(form.get("locale") ?? "en") === "hi" ? "hi" : "en",
            });
          }}
        >
          <TextField
            name="name"
            label="Your name"
            error={errors.name}
            icon={<User className="size-4" />}
            inputProps={{
              required: true,
              autoFocus: true,
              defaultValue: initial.name,
              autoComplete: "name",
            }}
          />

          <TextField
            name="phone"
            label="Phone"
            error={errors.phone}
            icon={<Phone className="size-4" />}
            description="Optional — only for cohort and live session reminders."
            inputProps={{
              type: "tel",
              defaultValue: initial.phone ?? "",
              autoComplete: "tel",
              placeholder: "+91 98765 43210",
            }}
          />

          <TimezoneField defaultValue={initial.timezone} error={errors.timezone} />

          <Field name="locale" error={errors.locale}>
            <FieldLabel>Language</FieldLabel>
            <FieldControl>
              <select
                defaultValue={initial.locale}
                className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                <option value="en">English</option>
                <option value="hi">हिन्दी (Hindi)</option>
              </select>
            </FieldControl>
          </Field>

          <SubmitButton pending={isPending} pendingLabel="Saving…">
            Continue
          </SubmitButton>
        </form>

        <SkipLink />
      </div>
    </FadeIn>
  );
}
