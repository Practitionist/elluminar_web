"use client";

import { KeyRound, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  AuthHeader,
  FormAlert,
  SubmitButton,
} from "@/components/auth";
import { Checkbox } from "@/components/ui/checkbox";
import { FadeIn } from "@/components/ui/fade-in";
import { Field, FieldControl, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
import { twoFactorCodeSchema } from "@/lib/validation/auth";

export default function TwoFactorPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [useBackup, setUseBackup] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formMessage, setFormMessage] = useState<string>();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = twoFactorCodeSchema.safeParse({
      code: form.get("code"),
      trustDevice: form.get("trustDevice") === "on",
    });

    if (!parsed.success) {
      setErrors({ code: parsed.error.issues[0]?.message ?? "Enter your code" });
      return;
    }

    setErrors({});
    setFormMessage(undefined);
    setPending(true);
    const { error } = useBackup
      ? await authClient.twoFactor.verifyBackupCode({ code: parsed.data.code })
      : await authClient.twoFactor.verifyTotp({
          code: parsed.data.code,
          trustDevice: parsed.data.trustDevice,
        });
    setPending(false);

    if (error) {
      setFormMessage(
        error.status === 429
          ? "Too many attempts. Wait a minute before trying again."
          : useBackup
            ? "That backup code isn't valid, or it has already been used."
            : "That code isn't valid. Codes rotate every 30 seconds — try the current one.",
      );
      return;
    }

    router.push("/learn");
    router.refresh();
  }

  return (
    <FadeIn direction="up" duration={0.4}>
      <div className="space-y-6">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary-subtle">
          {useBackup ? (
            <KeyRound className="size-6 text-primary-subtle-foreground" />
          ) : (
            <ShieldCheck className="size-6 text-primary-subtle-foreground" />
          )}
        </div>

        <AuthHeader
          title="Two-factor authentication"
          description={
            useBackup
              ? "Enter one of the backup codes you saved when you turned 2FA on. Each one works once."
              : "Enter the 6-digit code from your authenticator app."
          }
        />

        {formMessage ? <FormAlert>{formMessage}</FormAlert> : null}

        {/* Remounts on toggle so autofill and the inputMode switch cleanly. */}
        <form
          key={useBackup ? "backup" : "totp"}
          onSubmit={onSubmit}
          className="space-y-4"
          noValidate
        >
          <Field name="code" error={errors.code}>
            <FieldLabel>{useBackup ? "Backup code" : "Authentication code"}</FieldLabel>
            <FieldControl>
              <Input
                size="lg"
                inputMode={useBackup ? "text" : "numeric"}
                autoComplete="one-time-code"
                autoFocus
                required
                maxLength={useBackup ? 24 : 6}
                className="text-center font-mono tracking-[0.3em]"
              />
            </FieldControl>
          </Field>

          {!useBackup ? (
            <div className="flex items-start gap-2.5">
              <Checkbox id="trustDevice" name="trustDevice" className="mt-0.5" />
              <Label htmlFor="trustDevice" className="text-sm leading-snug font-normal">
                Trust this device for 60 days
              </Label>
            </div>
          ) : null}

          <SubmitButton pending={pending} pendingLabel="Verifying…">
            Verify
          </SubmitButton>
        </form>

        <button
          type="button"
          className="w-full text-center text-sm text-muted-foreground hover:text-primary hover:underline"
          onClick={() => {
            setErrors({});
            setFormMessage(undefined);
            setUseBackup((v) => !v);
          }}
        >
          {useBackup ? "Use an authenticator code instead" : "Use a backup code instead"}
        </button>
      </div>
    </FadeIn>
  );
}
