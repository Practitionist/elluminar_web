"use client";

import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { toggleFeatureFlag } from "@/actions/ops";
import { Switch } from "@/components/ui/switch";

export function FlagToggle({ flagKey, enabled }: { flagKey: string; enabled: boolean }) {
  const { execute, isPending } = useAction(toggleFeatureFlag, {
    onSuccess: () => toast.success("Flag updated"),
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });

  return (
    <Switch
      defaultChecked={enabled}
      disabled={isPending}
      onCheckedChange={(checked) => execute({ key: flagKey, enabled: checked })}
    />
  );
}
