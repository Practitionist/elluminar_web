"use client";

import { Check, Copy, Download, ShieldCheck, ShieldOff } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import QRCode from "react-qr-code";
import { toast } from "sonner";

import { recordSecurityEvent } from "@/actions/account";
import { AccountSection } from "@/components/account/section";
import { FormAlert, PasswordField, SubmitButton } from "@/components/auth";
import { Pill } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Field, FieldControl, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";
import { totpCodeSchema } from "@/lib/validation/auth";

type Stage =
  | { step: "idle" }
  | { step: "password" }
  | { step: "scan"; totpURI: string; backupCodes: string[] }
  | { step: "codes"; backupCodes: string[] }
  | { step: "disable" };

/**
 * 2FA enrolment. The twoFactor plugin has been enabled and /two-factor has
 * verified challenges since day one — but nothing in the app ever called
 * `twoFactor.enable`, so no user could turn it on in the first place.
 *
 * The flow deliberately confirms a live TOTP code before treating 2FA as on:
 * enabling from the secret alone would lock out anyone whose authenticator
 * failed to scan, and the backup codes are shown exactly once.
 */
export function TwoFactorPanel({
  enabled,
  hasPassword,
}: {
  enabled: boolean;
  hasPassword: boolean;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>({ step: "idle" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const audit = useAction(recordSecurityEvent);

  async function onEnable(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    setError(undefined);
    setPending(true);
    const { data, error: enableError } = await authClient.twoFactor.enable({ password });
    setPending(false);

    if (enableError || !data) {
      setError(
        enableError?.status === 401
          ? "That password isn't right."
          : (enableError?.message ?? "Could not start 2FA setup."),
      );
      return;
    }
    setStage({ step: "scan", totpURI: data.totpURI, backupCodes: data.backupCodes });
  }

  async function onVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (stage.step !== "scan") return;

    const parsed = totpCodeSchema.safeParse({
      code: new FormData(e.currentTarget).get("code"),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter the 6-digit code");
      return;
    }

    setError(undefined);
    setPending(true);
    const { error: verifyError } = await authClient.twoFactor.verifyTotp({
      code: parsed.data.code,
    });
    setPending(false);

    if (verifyError) {
      setError("That code isn't valid. Codes rotate every 30 seconds — try the current one.");
      return;
    }

    audit.execute({ event: "two_factor.enabled" });
    setStage({ step: "codes", backupCodes: stage.backupCodes });
    toast.success("Two-factor authentication is on.");
  }

  async function onDisable(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    setError(undefined);
    setPending(true);
    const { error: disableError } = await authClient.twoFactor.disable({ password });
    setPending(false);

    if (disableError) {
      setError(
        disableError.status === 401
          ? "That password isn't right."
          : (disableError.message ?? "Could not turn 2FA off."),
      );
      return;
    }

    audit.execute({ event: "two_factor.disabled" });
    setStage({ step: "idle" });
    toast.success("Two-factor authentication is off.");
    router.refresh();
  }

  if (!hasPassword) {
    return (
      <AccountSection
        title="Two-factor authentication"
        description="An extra code from your phone, on top of your password."
      >
        <FormAlert tone="info">
          You sign in with Google or your organization&apos;s identity provider,
          so two-factor is managed there rather than here.
        </FormAlert>
      </AccountSection>
    );
  }

  return (
    <AccountSection
      title="Two-factor authentication"
      description="An extra code from your authenticator app, on top of your password."
    >
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          {enabled ? (
            <Pill tone="success">
              <ShieldCheck className="size-3.5" />
              on
            </Pill>
          ) : (
            <Pill tone="neutral">
              <ShieldOff className="size-3.5" />
              off
            </Pill>
          )}
        </div>

        {error ? <FormAlert>{error}</FormAlert> : null}

        {stage.step === "idle" && !enabled ? (
          <Button
            size="lg"
            className="rounded-full"
            onClick={() => {
              setError(undefined);
              setStage({ step: "password" });
            }}
          >
            Turn on two-factor
          </Button>
        ) : null}

        {stage.step === "idle" && enabled ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="lg"
              className="rounded-full"
              onClick={() => {
                setError(undefined);
                setStage({ step: "disable" });
              }}
            >
              Turn off
            </Button>
          </div>
        ) : null}

        {stage.step === "password" ? (
          <form onSubmit={onEnable} className="space-y-4" noValidate>
            <PasswordField
              name="password"
              label="Confirm your password"
              autoComplete="current-password"
              description="We ask again so a borrowed session can't add a second factor you don't control."
            />
            <div className="flex gap-2">
              <SubmitButton pending={pending} pendingLabel="Starting…" className="w-auto px-6">
                Continue
              </SubmitButton>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                className="rounded-full"
                onClick={() => setStage({ step: "idle" })}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : null}

        {stage.step === "scan" ? (
          <div className="space-y-5">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              {/* White plate regardless of theme — scanners need the contrast. */}
              <div className="w-fit shrink-0 rounded-xl bg-white p-3">
                <QRCode value={stage.totpURI} size={148} />
              </div>
              <div className="space-y-2 text-sm">
                <p className="font-medium">
                  Scan this with Google Authenticator, 1Password, Authy, or any
                  TOTP app.
                </p>
                <p className="text-muted-foreground">
                  Can&apos;t scan? Open the setup key below and enter it by hand.
                </p>
                <details className="text-xs">
                  <summary className="cursor-pointer text-primary hover:underline">
                    Show setup key
                  </summary>
                  <code className="mt-2 block break-all rounded-lg bg-muted p-2 font-mono">
                    {new URL(stage.totpURI).searchParams.get("secret")}
                  </code>
                </details>
              </div>
            </div>

            <form onSubmit={onVerify} className="space-y-4" noValidate>
              <Field name="code">
                <FieldLabel>Enter the 6-digit code</FieldLabel>
                <FieldControl>
                  <Input
                    size="lg"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                    autoFocus
                    className="max-w-48 text-center font-mono tracking-[0.3em]"
                  />
                </FieldControl>
                <FieldDescription>
                  Confirming a live code proves the app is set up before we start
                  requiring it.
                </FieldDescription>
              </Field>
              <div className="flex gap-2">
                <SubmitButton
                  pending={pending}
                  pendingLabel="Verifying…"
                  className="w-auto px-6"
                >
                  Verify and turn on
                </SubmitButton>
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  className="rounded-full"
                  onClick={() => setStage({ step: "idle" })}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        ) : null}

        {stage.step === "codes" ? (
          <BackupCodes
            codes={stage.backupCodes}
            onDone={() => {
              setStage({ step: "idle" });
              router.refresh();
            }}
          />
        ) : null}

        {stage.step === "disable" ? (
          <form onSubmit={onDisable} className="space-y-4" noValidate>
            <FormAlert tone="info">
              Turning 2FA off means your password alone can sign you in.
            </FormAlert>
            <PasswordField
              name="password"
              label="Confirm your password"
              autoComplete="current-password"
            />
            <div className="flex gap-2">
              <SubmitButton
                pending={pending}
                pendingLabel="Turning off…"
                variant="destructive"
                className="w-auto px-6"
              >
                Turn off two-factor
              </SubmitButton>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                className="rounded-full"
                onClick={() => setStage({ step: "idle" })}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : null}
      </div>
    </AccountSection>
  );
}

/** Shown exactly once — BetterAuth stores these hashed and cannot re-display them. */
function BackupCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const asText = codes.join("\n");

  return (
    <div className="space-y-4">
      <FormAlert tone="success" title="Two-factor is on">
        Save these backup codes now. Each one signs you in once if you lose your
        phone — and this is the only time they can be shown.
      </FormAlert>

      <ul className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-muted/40 p-4 font-mono text-sm">
        {codes.map((code) => (
          <li key={code} className="tracking-wider">
            {code}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="lg"
          className="rounded-full"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(asText);
              setCopied(true);
              setAcknowledged(true);
              setTimeout(() => setCopied(false), 1600);
            } catch {
              toast.error("Copy blocked — select the codes manually.");
            }
          }}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copied" : "Copy codes"}
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="rounded-full"
          onClick={() => {
            // Blob + object URL rather than a data: URI — Safari refuses to
            // download data: URIs opened from script.
            const blob = new Blob([`${asText}\n`], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "elluminar-backup-codes.txt";
            link.click();
            URL.revokeObjectURL(url);
            setAcknowledged(true);
          }}
        >
          <Download className="size-4" />
          Download
        </Button>
      </div>

      <Button
        size="lg"
        className="rounded-full"
        disabled={!acknowledged}
        onClick={onDone}
      >
        {acknowledged ? "I've saved them" : "Copy or download them first"}
      </Button>
    </div>
  );
}
