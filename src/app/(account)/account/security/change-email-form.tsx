"use client";

import { Mail } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";

import { requestEmailChange } from "@/actions/account";
import { AccountSection } from "@/components/account/section";
import { FormAlert, SubmitButton, TextField } from "@/components/auth";
import { Button } from "@/components/ui/button";
import { fieldErrors, formError } from "@/lib/form-errors";

export function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
  const [open, setOpen] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const { execute, isPending, result, reset } = useAction(requestEmailChange, {
    onSuccess({ data }) {
      setSentTo(data?.sentTo ?? currentEmail);
      setOpen(false);
    },
  });

  const errors = fieldErrors(result?.validationErrors);
  const topLevelError = formError(result?.validationErrors) ?? result?.serverError;

  return (
    <AccountSection
      title="Email address"
      description="Where sign-in links and every account notice go."
    >
      <div className="space-y-4">
        <p className="font-mono text-sm">{currentEmail}</p>

        {sentTo ? (
          <FormAlert tone="success" title="Check your current inbox">
            We sent a confirmation link to{" "}
            <span className="font-medium">{sentTo}</span>. The change takes effect
            once you follow it — we ask the old address, not the new one, so that
            an unauthorized change is visible to you.
          </FormAlert>
        ) : null}

        {!open ? (
          <Button
            variant="outline"
            size="lg"
            className="rounded-full"
            onClick={() => {
              reset();
              setSentTo(null);
              setOpen(true);
            }}
          >
            Change email
          </Button>
        ) : (
          <form
            className="space-y-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              execute({
                newEmail: String(new FormData(e.currentTarget).get("newEmail") ?? ""),
              });
            }}
          >
            {topLevelError ? <FormAlert>{topLevelError}</FormAlert> : null}
            <TextField
              name="newEmail"
              label="New email address"
              error={errors.newEmail}
              icon={<Mail className="size-4" />}
              inputProps={{
                type: "email",
                required: true,
                autoFocus: true,
                autoComplete: "email",
                placeholder: "you@example.com",
              }}
            />
            <div className="flex gap-2">
              <SubmitButton
                pending={isPending}
                pendingLabel="Sending…"
                className="w-auto px-6"
              >
                Send confirmation
              </SubmitButton>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                className="rounded-full"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </AccountSection>
  );
}
