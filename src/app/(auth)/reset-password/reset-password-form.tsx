"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  AuthHeader,
  FormAlert,
  PasswordField,
  PasswordStrengthMeter,
  SubmitButton,
} from "@/components/auth";
import { FadeIn } from "@/components/ui/fade-in";
import { authClient } from "@/lib/auth/client";
import { resetPasswordSchema } from "@/lib/validation/auth";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formMessage, setFormMessage] = useState<string>();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = resetPasswordSchema.safeParse({
      password: form.get("password"),
      confirmPassword: form.get("confirmPassword"),
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
    const { error } = await authClient.resetPassword({
      newPassword: parsed.data.password,
      token,
    });
    setPending(false);

    if (error) {
      setFormMessage(
        error.message ??
          "That link is no longer valid. Request a fresh one from the sign-in page.",
      );
      return;
    }

    // BetterAuth's onPasswordReset revokes other sessions, so sending them to
    // sign-in is the honest next step rather than a silent redirect to /learn.
    toast.success("Password updated. Sign in with your new password.");
    router.push("/sign-in");
  }

  return (
    <FadeIn direction="up" duration={0.4}>
      <div className="space-y-6">
        <AuthHeader
          title="Choose a new password"
          description="Pick something you don't use anywhere else. You'll be signed out on other devices."
        />

        {formMessage ? <FormAlert>{formMessage}</FormAlert> : null}

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <PasswordField
              name="password"
              label="New password"
              error={errors.password}
              autoComplete="new-password"
              value={password}
              onValueChange={setPassword}
            />
            <PasswordStrengthMeter password={password} />
          </div>
          <PasswordField
            name="confirmPassword"
            label="Confirm new password"
            error={errors.confirmPassword}
            autoComplete="new-password"
          />
          <SubmitButton pending={pending} pendingLabel="Updating…">
            Update password
          </SubmitButton>
        </form>
      </div>
    </FadeIn>
  );
}
