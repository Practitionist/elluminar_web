"use client";

import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

import {
  setProjectPrice,
  submitProjectForReview,
  updateProjectBasics,
} from "@/actions/projects";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function ProjectEditorForms({
  tenantSlug,
  projectId,
  status,
  defaults,
}: {
  tenantSlug: string;
  projectId: string;
  status: string;
  defaults: {
    title: string;
    summary: string;
    brief: string;
    techStack: string;
    visibility: string;
    baseRupees: number | null;
    seniorRupees: number | null;
    principalRupees: number | null;
  };
}) {
  const [visibility, setVisibility] = useState(defaults.visibility);

  const basics = useAction(updateProjectBasics, {
    onSuccess: () => toast.success("Saved"),
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });
  const price = useAction(setProjectPrice, {
    onSuccess: () => toast.success("Price saved"),
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });
  const submit = useAction(submitProjectForReview, {
    onSuccess: () => toast.success("Submitted for review"),
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Basics</CardTitle>
          {status === "DRAFT" && (
            <Button
              size="sm"
              disabled={submit.isPending}
              onClick={() => submit.execute({ tenantSlug, projectId })}
            >
              {submit.isPending ? "Submitting…" : "Submit for review"}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              basics.execute({
                tenantSlug,
                projectId,
                title: String(form.get("title")),
                summary: String(form.get("summary")),
                brief: String(form.get("brief")),
                techStack: String(form.get("techStack") || "")
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
                visibility: visibility as never,
              });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" defaultValue={defaults.title} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="summary">Summary</Label>
              <Textarea id="summary" name="summary" rows={2} defaultValue={defaults.summary} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brief">Brief</Label>
              <Textarea id="brief" name="brief" rows={8} defaultValue={defaults.brief} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="techStack">Tech stack</Label>
                <Input id="techStack" name="techStack" defaultValue={defaults.techStack} />
              </div>
              <div className="space-y-2">
                <Label>Visibility</Label>
                <Select value={visibility} onValueChange={(v) => setVisibility(v ?? "MARKETPLACE")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MARKETPLACE">Marketplace + storefront</SelectItem>
                    <SelectItem value="TENANT_ONLY">Storefront only</SelectItem>
                    <SelectItem value="PRIVATE">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" disabled={basics.isPending}>
              {basics.isPending ? "Saving…" : "Save basics"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pricing (INR, tax-inclusive)</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const base = Number(form.get("base") || 0);
              price.execute({ tenantSlug, projectId, amountRupees: base });
              const senior = form.get("senior") ? Number(form.get("senior")) : null;
              const principal = form.get("principal") ? Number(form.get("principal")) : null;
              if (senior != null)
                price.execute({ tenantSlug, projectId, amountRupees: senior, mentorLevel: "SENIOR" });
              if (principal != null)
                price.execute({ tenantSlug, projectId, amountRupees: principal, mentorLevel: "PRINCIPAL" });
            }}
            className="grid gap-4 sm:grid-cols-3"
          >
            <div className="space-y-2">
              <Label htmlFor="base">Base (associate mentor)</Label>
              <Input id="base" name="base" type="number" min={0} defaultValue={defaults.baseRupees ?? ""} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senior">Senior mentor</Label>
              <Input id="senior" name="senior" type="number" min={0} defaultValue={defaults.seniorRupees ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="principal">Principal mentor</Label>
              <Input id="principal" name="principal" type="number" min={0} defaultValue={defaults.principalRupees ?? ""} />
            </div>
            <div className="sm:col-span-3">
              <Button type="submit" disabled={price.isPending}>
                {price.isPending ? "Saving…" : "Save prices"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
