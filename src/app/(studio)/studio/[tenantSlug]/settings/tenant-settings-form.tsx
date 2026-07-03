"use client";

import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { updateTenantSettings } from "@/actions/tenant";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function TenantSettingsForm({
  tenantSlug,
  defaults,
}: {
  tenantSlug: string;
  defaults: {
    displayName: string;
    about: string;
    supportEmail: string;
    website: string;
    youtube: string;
  };
}) {
  const { execute, isPending } = useAction(updateTenantSettings, {
    onSuccess: () => toast.success("Settings saved"),
    onError: ({ error }) => toast.error(error.serverError ?? "Save failed"),
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    execute({
      tenantSlug,
      displayName: String(form.get("displayName")),
      about: String(form.get("about") || ""),
      supportEmail: String(form.get("supportEmail") || ""),
      socials: {
        website: String(form.get("website") || ""),
        youtube: String(form.get("youtube") || ""),
      },
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="displayName">Display name</Label>
            <Input id="displayName" name="displayName" defaultValue={defaults.displayName} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="about">About</Label>
            <Textarea id="about" name="about" rows={5} defaultValue={defaults.about} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="supportEmail">Support email</Label>
            <Input id="supportEmail" name="supportEmail" type="email" defaultValue={defaults.supportEmail} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input id="website" name="website" type="url" defaultValue={defaults.website} placeholder="https://…" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="youtube">YouTube</Label>
              <Input id="youtube" name="youtube" type="url" defaultValue={defaults.youtube} placeholder="https://youtube.com/@…" />
            </div>
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
