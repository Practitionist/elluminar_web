"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { addToCart } from "@/actions/cart";
import { Button } from "@/components/ui/button";

export function AddToCartButton({
  itemType,
  courseId,
  cohortId,
  projectId,
  planId,
  mentorLevel,
  label = "Add to cart",
  variant = "default",
  size = "lg",
}: {
  itemType: "COURSE" | "COHORT_SEAT" | "PROJECT" | "PLAN";
  courseId?: string;
  cohortId?: string;
  projectId?: string;
  planId?: string;
  mentorLevel?: "ASSOCIATE" | "SENIOR" | "PRINCIPAL";
  label?: string;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
}) {
  const router = useRouter();
  const { execute, isPending } = useAction(addToCart, {
    onSuccess: () => {
      toast.success("Added to cart");
      router.push("/cart");
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Could not add"),
  });

  return (
    <Button
      onClick={() => execute({ itemType, courseId, cohortId, projectId, planId, mentorLevel })}
      disabled={isPending}
      variant={variant}
      size={size}
    >
      {isPending ? "Adding…" : label}
    </Button>
  );
}
