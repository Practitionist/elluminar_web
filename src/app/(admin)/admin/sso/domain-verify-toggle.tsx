"use client";

import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { setSsoDomainVerified } from "@/actions/org-sso";
import { Switch } from "@/components/ui/switch";

export function DomainVerifyToggle({
  providerId,
  verified,
}: {
  providerId: string;
  verified: boolean;
}) {
  const { execute, isPending } = useAction(setSsoDomainVerified, {
    onSuccess: () => toast.success("Updated"),
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });
  return (
    <Switch
      defaultChecked={verified}
      disabled={isPending}
      onCheckedChange={(checked) => execute({ providerId, verified: checked })}
    />
  );
}
