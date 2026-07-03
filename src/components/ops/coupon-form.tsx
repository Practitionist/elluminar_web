"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type CouponFormValues = {
  code: string;
  name: string;
  discountType: "PERCENT" | "FIXED_AMOUNT";
  percentOff?: number;
  amountOffRupees?: number;
  maxRedemptions?: number;
  endsAt?: Date | null;
};

export function CouponForm({
  onSubmit,
  isPending,
}: {
  onSubmit: (values: CouponFormValues) => void;
  isPending: boolean;
}) {
  const [discountType, setDiscountType] = useState<"PERCENT" | "FIXED_AMOUNT">("PERCENT");

  return (
    <Card>
      <CardContent className="pt-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const percentOff = form.get("percentOff") ? Number(form.get("percentOff")) : undefined;
            const amountOffRupees = form.get("amountOff")
              ? Number(form.get("amountOff"))
              : undefined;
            if (discountType === "PERCENT" && !percentOff) {
              toast.error("Set a percent value");
              return;
            }
            if (discountType === "FIXED_AMOUNT" && !amountOffRupees) {
              toast.error("Set an amount");
              return;
            }
            onSubmit({
              code: String(form.get("code")),
              name: String(form.get("name")),
              discountType,
              percentOff,
              amountOffRupees,
              maxRedemptions: form.get("maxRedemptions")
                ? Number(form.get("maxRedemptions"))
                : undefined,
              endsAt: form.get("endsAt") ? new Date(String(form.get("endsAt"))) : null,
            });
          }}
          className="grid gap-4 sm:grid-cols-2"
        >
          <div className="space-y-2">
            <Label htmlFor="code">Code</Label>
            <Input id="code" name="code" required placeholder="LAUNCH20" className="uppercase" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Internal name</Label>
            <Input id="name" name="name" required placeholder="Launch campaign" />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={discountType}
              onValueChange={(v) => setDiscountType((v as never) ?? "PERCENT")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PERCENT">Percent off</SelectItem>
                <SelectItem value="FIXED_AMOUNT">Amount off (₹)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {discountType === "PERCENT" ? (
            <div className="space-y-2">
              <Label htmlFor="percentOff">Percent off</Label>
              <Input id="percentOff" name="percentOff" type="number" min={1} max={100} />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="amountOff">Amount off (₹)</Label>
              <Input id="amountOff" name="amountOff" type="number" min={1} />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="maxRedemptions">Max redemptions (blank = unlimited)</Label>
            <Input id="maxRedemptions" name="maxRedemptions" type="number" min={1} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endsAt">Expires</Label>
            <Input id="endsAt" name="endsAt" type="date" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating…" : "Create coupon"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
