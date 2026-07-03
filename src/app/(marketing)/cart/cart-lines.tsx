"use client";

import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { removeFromCart } from "@/actions/cart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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
        <Card key={line.cartItemId}>
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{line.kind.toLowerCase().replace("_", " ")}</Badge>
                <span className="truncate font-medium">{line.title}</span>
              </div>
              {line.detail && (
                <p className="mt-0.5 text-sm text-muted-foreground">{line.detail}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <div className="text-right text-sm">
                {line.discounted ? (
                  <>
                    <div className="font-medium">{line.discounted}</div>
                    <div className="text-xs text-muted-foreground line-through">
                      {line.amount}
                    </div>
                  </>
                ) : (
                  <div className="font-medium">{line.amount}</div>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={isPending}
                onClick={() => execute({ cartItemId: line.cartItemId })}
                title="Remove"
              >
                ✕
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
