"use client";

import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { setSsoDomainVerified } from "@/actions/org-sso";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

/**
 * Granting trust here is not the same as the customer proving it. BetterAuth
 * rejects `verifyDomain` once `domainVerified` is true, so an override closes
 * the org's own DNS route until it is revoked — worth saying out loud rather
 * than hiding behind an unlabelled switch.
 */
export function DomainVerifyToggle({
  providerId,
  verified,
}: {
  providerId: string;
  verified: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<boolean | null>(null);

  const { execute, isPending } = useAction(setSsoDomainVerified, {
    onSuccess: () => {
      toast.success(
        confirming ? "Provider trusted — sign-ins are live." : "Trust revoked.",
      );
      setConfirming(null);
      router.refresh();
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Failed");
      setConfirming(null);
    },
  });

  if (confirming !== null) {
    return (
      <div className="max-w-xs space-y-2 rounded-xl border border-border p-3">
        <p className="text-xs leading-relaxed">
          {confirming
            ? "Everyone with an email at this domain will be auto-provisioned into this organization. Only do this if you have confirmed ownership out of band."
            : "Sign-ins through this provider stop immediately. The organization can then re-verify by DNS."}
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={confirming ? "default" : "destructive"}
            className="rounded-full"
            disabled={isPending}
            onClick={() =>
              execute({
                providerId,
                verified: confirming,
                reason: confirming ? "platform-admin override" : "platform-admin revoke",
              })
            }
          >
            {isPending ? "Working…" : confirming ? "Trust it" : "Revoke"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full"
            onClick={() => setConfirming(null)}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Switch
      checked={verified}
      disabled={isPending}
      aria-label={verified ? "Revoke domain trust" : "Grant domain trust"}
      onCheckedChange={(checked) => setConfirming(checked)}
    />
  );
}
