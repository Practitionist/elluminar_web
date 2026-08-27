"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { FormAlert, SubmitButton } from "@/components/auth";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

export function InvitationActions({
  invitationId,
  destination,
  organizationName,
}: {
  invitationId: string;
  /** Where the user lands after joining — org portal or creator studio. */
  destination: string;
  organizationName: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<null | "accept" | "decline">(null);
  const [error, setError] = useState<string>();

  async function onAccept() {
    setError(undefined);
    setPending("accept");
    const { error: acceptError } = await authClient.organization.acceptInvitation({
      invitationId,
    });
    setPending(null);

    if (acceptError) {
      setError(acceptError.message ?? "Could not accept this invitation.");
      return;
    }

    toast.success(`You've joined ${organizationName}.`);
    router.push(destination);
    router.refresh();
  }

  async function onDecline() {
    setError(undefined);
    setPending("decline");
    // The old Decline button just navigated home, leaving the invitation
    // pending until it expired — and still listed as outstanding to the inviter.
    const { error: rejectError } = await authClient.organization.rejectInvitation({
      invitationId,
    });
    setPending(null);

    if (rejectError) {
      setError(rejectError.message ?? "Could not decline this invitation.");
      return;
    }

    toast.success("Invitation declined.");
    router.push("/");
  }

  return (
    <div className="space-y-3">
      {error ? <FormAlert>{error}</FormAlert> : null}
      <SubmitButton
        type="button"
        pending={pending === "accept"}
        pendingLabel="Joining…"
        disabled={pending !== null}
        onClick={onAccept}
      >
        Accept invitation
      </SubmitButton>
      <Button
        type="button"
        variant="ghost"
        size="lg"
        className="w-full rounded-full"
        disabled={pending !== null}
        onClick={onDecline}
      >
        {pending === "decline" ? "Declining…" : "Decline"}
      </Button>
    </div>
  );
}
