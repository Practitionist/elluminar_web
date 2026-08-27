"use client";

import { BadgeCheck, Phone, User } from "lucide-react";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { updateAccountProfile } from "@/actions/account";
import { AccountSection } from "@/components/account/section";
import { TimezoneField } from "@/components/account/timezone-field";
import { FormAlert, SubmitButton, TextField } from "@/components/auth";
import { Pill } from "@/components/shared";
import { Field, FieldControl, FieldLabel } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { fieldErrors, formError } from "@/lib/form-errors";
import type { OnboardingProfileInput } from "@/lib/validation/onboarding";

const LOCALES = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी (Hindi)" },
] as const;

export function ProfileForm({
  initial,
  email,
  emailVerified,
  memberSince,
}: {
  initial: OnboardingProfileInput;
  email: string;
  emailVerified: boolean;
  memberSince: Date;
}) {
  const { execute, isPending, result } = useAction(updateAccountProfile, {
    onSuccess: () => toast.success("Profile updated."),
    onError: ({ error }) => {
      if (!error.validationErrors) {
        toast.error(error.serverError ?? "Could not save your profile");
      }
    },
  });

  const errors = fieldErrors(result?.validationErrors);
  const topLevelError = formError(result?.validationErrors) ?? result?.serverError;

  return (
    <div className="space-y-6">
      <AccountSection
        title="Your details"
        description="Mentors see your name on the work they review."
        footer={
          <>
            Member since{" "}
            {memberSince.toLocaleDateString("en-IN", {
              month: "long",
              year: "numeric",
            })}
            .
          </>
        }
      >
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
              locale: (String(form.get("locale") ?? "en") === "hi" ? "hi" : "en"),
            });
          }}
        >
          {topLevelError ? <FormAlert>{topLevelError}</FormAlert> : null}

          <TextField
            name="name"
            label="Name"
            error={errors.name}
            icon={<User className="size-4" />}
            inputProps={{ required: true, defaultValue: initial.name, autoComplete: "name" }}
          />

          <TextField
            name="phone"
            label="Phone"
            error={errors.phone}
            icon={<Phone className="size-4" />}
            description="Optional. Only used for cohort and session reminders."
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
                {LOCALES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </FieldControl>
          </Field>

          <SubmitButton
            pending={isPending}
            pendingLabel="Saving…"
            className="w-auto px-8"
          >
            Save changes
          </SubmitButton>
        </form>
      </AccountSection>

      <AccountSection
        title="Email address"
        description="Used to sign in, and where every account notice goes."
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Label className="font-mono text-sm">{email}</Label>
            {emailVerified ? (
              <Pill tone="success">
                <BadgeCheck className="size-3.5" />
                verified
              </Pill>
            ) : (
              <Pill tone="distinction">unverified</Pill>
            )}
          </div>
          <Link
            href="/account/security"
            className="text-sm font-semibold text-primary hover:underline"
          >
            Change email
          </Link>
        </div>
      </AccountSection>
    </div>
  );
}
