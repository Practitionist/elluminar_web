"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";

import { markAllNotificationsRead } from "@/actions/notifications";
import { Button } from "@/components/ui/button";

export function MarkAllReadButton() {
  const router = useRouter();
  const { execute, isPending } = useAction(markAllNotificationsRead, {
    onSuccess: () => router.refresh(),
  });
  return (
    <Button variant="outline" size="sm" disabled={isPending} onClick={() => execute({})}>
      {isPending ? "Marking…" : "Mark all read"}
    </Button>
  );
}
