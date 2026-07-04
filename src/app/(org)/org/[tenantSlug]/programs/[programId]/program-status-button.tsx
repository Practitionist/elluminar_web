"use client";

import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { setProgramStatus } from "@/actions/program";
import { Button } from "@/components/ui/button";

export function ProgramStatusButton({
  tenantSlug,
  programId,
  status,
}: {
  tenantSlug: string;
  programId: string;
  status: string;
}) {
  const { execute, isPending } = useAction(setProgramStatus, {
    onSuccess: () => toast.success("Status updated"),
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });

  if (status === "ACTIVE") {
    return (
      <Button
        variant="outline"
        size="sm"
        className="rounded-full"
        disabled={isPending}
        onClick={() => execute({ tenantSlug, programId, status: "ARCHIVED" })}
      >
        Archive
      </Button>
    );
  }
  return (
    <Button
      size="sm"
      className="rounded-full"
      disabled={isPending}
      onClick={() => execute({ tenantSlug, programId, status: "ACTIVE" })}
    >
      {isPending ? "Activating…" : "Activate program"}
    </Button>
  );
}
