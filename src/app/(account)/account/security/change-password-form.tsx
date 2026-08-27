"use client";

import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

import { recordSecurityEvent } from "@/actions/account";
import { AccountSection } from "@/components/account/section";
import {
  FormAlert,
  PasswordField,
  PasswordStrengthMeter,
  SubmitButton,
} from "@/components/auth";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
import { changePasswordSchema } from "@/lib/validation/auth";

export function ChangePasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [pending, setPending] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formMessage, setFormMessage] = useState<string>();
  const audit = useAction(recordSecurityEvent);

  if (!hasPassword) {
    return (
      <AccountSection
        title="Password"
        description="This account has no password — you sign in with Google or your organization's identity provider."
      >
        <FormAlert tone="info">
          To add a password, use “Forgot password” on the sign-in page; the reset
          link will set one for this account.
        </FormAlert>
      </AccountSection>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = changePasswordSchema.safeParse({
      currentPassword: form.get("currentPassword"),
      newPassword: form.get("newPassword"),
      confirmPassword: form.get("confirmPassword"),
      revokeOtherSessions: form.get("revokeOtherSessions") === "on",
    });

    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((i) => [String(i.path[0]), i.message]),
        ),
      );
      return;
    }

    setErrors({});
    setFormMessage(undefined);
    setPending(true);
    const { error } = await authClient.changePassword({
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
      revokeOtherSessions: parsed.data.revokeOtherSessions,
    });
    setPending(false);

    if (error) {
      if (error.status === 400 || error.status === 401) {
        setErrors({ currentPassword: "That password isn't right." });
        return;
      }
      setFormMessage(error.message ?? "Could not change your password.");
      return;
    }

    audit.execute({ event: "password.changed" });
    setNewPassword("");
    (e.target as HTMLFormElement).reset();
    toast.success(
      parsed.data.revokeOtherSessions
        ? "Password changed. Other devices have been signed out."
        : "Password changed.",
    );
  }

  return (
    <AccountSection
      title="Password"
      description="Use something you don't reuse anywhere else."
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {formMessage ? <FormAlert>{formMessage}</FormAlert> : null}

        <PasswordField
          name="currentPassword"
          label="Current password"
          error={errors.currentPassword}
          autoComplete="current-password"
        />

        <div className="space-y-2">
          <PasswordField
            name="newPassword"
            label="New password"
            error={errors.newPassword}
            autoComplete="new-password"
            value={newPassword}
            onValueChange={setNewPassword}
          />
          <PasswordStrengthMeter password={newPassword} />
        </div>

        <PasswordField
          name="confirmPassword"
          label="Confirm new password"
          error={errors.confirmPassword}
          autoComplete="new-password"
        />

        <div className="flex items-start gap-2.5">
          <Checkbox
            id="revokeOtherSessions"
            name="revokeOtherSessions"
            defaultChecked
            className="mt-0.5"
          />
          <Label
            htmlFor="revokeOtherSessions"
            className="text-sm leading-snug font-normal"
          >
            Sign out everywhere else. Leave this on if you&apos;re changing your
            password because you think someone else has it.
          </Label>
        </div>

        <SubmitButton pending={pending} pendingLabel="Updating…" className="w-auto px-8">
          Change password
        </SubmitButton>
      </form>
    </AccountSection>
  );
}
