"use client";

import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { setCoursePrice } from "@/actions/course";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CoursePricingForm({
  tenantSlug,
  courseId,
  defaults,
}: {
  tenantSlug: string;
  courseId: string;
  defaults: { amountRupees: number | null; compareAtRupees: number | null };
}) {
  const { execute, isPending } = useAction(setCoursePrice, {
    onSuccess: () => toast.success("Price saved"),
    onError: ({ error }) => toast.error(error.serverError ?? "Save failed"),
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    execute({
      tenantSlug,
      courseId,
      amountRupees: Number(form.get("amountRupees") || 0),
      compareAtRupees: form.get("compareAtRupees")
        ? Number(form.get("compareAtRupees"))
        : null,
    });
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Self-paced price (INR)</CardTitle>
        <CardDescription>
          Tax-inclusive. Live-cohort seats are priced per cohort in the Cohorts
          tab. Multi-currency and regional pricing arrive post-MVP.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amountRupees">Price (₹)</Label>
              <Input
                id="amountRupees"
                name="amountRupees"
                type="number"
                min={0}
                step="1"
                defaultValue={defaults.amountRupees ?? ""}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="compareAtRupees">Compare-at (₹)</Label>
              <Input
                id="compareAtRupees"
                name="compareAtRupees"
                type="number"
                min={0}
                step="1"
                defaultValue={defaults.compareAtRupees ?? ""}
              />
            </div>
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Save price"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
