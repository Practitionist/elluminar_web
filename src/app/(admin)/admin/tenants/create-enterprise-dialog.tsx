"use client";

import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

import { adminCreateEnterpriseTenant } from "@/actions/enterprise-tenant";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const slugify = (v: string) =>
  v.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 48);

export function CreateEnterpriseDialog() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"ENTERPRISE" | "UNIVERSITY">("ENTERPRISE");
  const [slug, setSlug] = useState("");

  const { execute, isPending } = useAction(adminCreateEnterpriseTenant, {
    onSuccess({ data }) {
      toast.success(`Tenant created — owner invitation sent. Portal: /org/${data?.tenantSlug}`);
      setOpen(false);
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>+ New enterprise tenant</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create enterprise/university tenant (sales-led)</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            execute({
              name: String(form.get("name")),
              slug,
              type,
              primaryAdminEmail: String(form.get("primaryAdminEmail")),
              about: String(form.get("about") || "") || undefined,
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="name">Organization name</Label>
            <Input
              id="name"
              name="name"
              required
              onChange={(e) => setSlug(slugify(e.target.value))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" value={slug} onChange={(e) => setSlug(slugify(e.target.value))} required />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType((v as never) ?? "ENTERPRISE")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENTERPRISE">Company</SelectItem>
                  <SelectItem value="UNIVERSITY">University</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="primaryAdminEmail">Primary admin email (invited as owner)</Label>
            <Input id="primaryAdminEmail" name="primaryAdminEmail" type="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="about">Notes (public about)</Label>
            <Input id="about" name="about" />
          </div>
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Creating…" : "Create & invite owner"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Created pre-approved (contract exists). You remain a member for
            customer-success access.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
