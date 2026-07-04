"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { redeemFromPool } from "@/actions/org-catalog";
import { Button } from "@/components/ui/button";

export function RedeemButton({
  licenseId,
  itemType,
  courseId,
  projectId,
  title,
  priceLabel,
  disabled,
}: {
  licenseId: string;
  itemType: "COURSE" | "PROJECT";
  courseId?: string;
  projectId?: string;
  title: string;
  priceLabel: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const { execute, isPending } = useAction(redeemFromPool, {
    onSuccess({ data }) {
      toast.success(`Redeemed “${data?.title}” — you're in!`);
      router.refresh();
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Redemption failed"),
  });

  return (
    <Button
      size="sm"
      className="rounded-full"
      disabled={disabled || isPending}
      onClick={() => {
        if (
          window.confirm(
            `Redeem “${title}” for ${priceLabel} from your organization's credit pool?`,
          )
        ) {
          execute({ licenseId, itemType, courseId, projectId });
        }
      }}
    >
      {isPending ? "Redeeming…" : disabled ? "Pool too low" : "Redeem"}
    </Button>
  );
}
