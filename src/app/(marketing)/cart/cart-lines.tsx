"use client";

import { useAction } from "next-safe-action/hooks";
import { X } from "lucide-react";
import { toast } from "sonner";

import { removeFromCart } from "@/actions/cart";
import { Pill } from "@/components/shared";
import { Button } from "@/components/ui/button";

export function CartLines({
  lines,
}: {
  lines: Array<{
    cartItemId: string;
    title: string;
    kind: string;
    detail: string | null;
    amount: string;
    discounted: string | null;
  }>;
}) {
  const { execute, isPending } = useAction(removeFromCart, {
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });

  return (
    <div className="space-y-3">
      {lines.map((line) => (
        <div
          key={line.cartItemId}
          className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Pill tone="primary" className="px-2.5 py-0.5 text-[11px]">
                {line.kind.toLowerCase().replace("_", " ")}
              </Pill>
              <span className="truncate font-bold text-foreground">{line.title}</span>
            </div>
            {line.detail && (
              <p className="mt-1 text-sm text-muted-foreground">{line.detail}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="text-right text-sm">
              {line.discounted ? (
                <>
                  <div className="font-extrabold text-foreground">{line.discounted}</div>
                  <div className="text-xs text-muted-foreground line-through">
                    {line.amount}
                  </div>
                </>
              ) : (
                <div className="font-extrabold text-foreground">{line.amount}</div>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full text-muted-foreground hover:text-destructive-subtle-foreground"
              disabled={isPending}
              onClick={() => execute({ cartItemId: line.cartItemId })}
              title="Remove"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
