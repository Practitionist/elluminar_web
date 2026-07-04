"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { requestReport } from "@/actions/reports";
import { Button } from "@/components/ui/button";

export function RequestReportButtons({ tenantSlug }: { tenantSlug: string }) {
  const router = useRouter();
  const { execute, isPending } = useAction(requestReport, {
    onSuccess: () => {
      toast.success("Report queued — it appears below when ready.");
      setTimeout(() => router.refresh(), 3000);
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        className="rounded-full"
        disabled={isPending}
        onClick={() => execute({ tenantSlug, kind: "COMPLETION" })}
      >
        Export completion CSV
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="rounded-full"
        disabled={isPending}
        onClick={() => execute({ tenantSlug, kind: "ENGAGEMENT" })}
      >
        Export engagement CSV
      </Button>
    </div>
  );
}
