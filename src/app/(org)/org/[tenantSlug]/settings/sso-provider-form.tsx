"use client";

import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

import { registerOrgSsoProvider, removeOrgSsoProvider } from "@/actions/org-sso";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { env } from "@/env";

const slugify = (v: string) =>
  v.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/[\s_]+/g, "-").slice(0, 48);

export function SsoProviderForm({ tenantSlug }: { tenantSlug: string }) {
  const [open, setOpen] = useState(false);
  const { execute, isPending } = useAction(registerOrgSsoProvider, {
    onSuccess: () => {
      toast.success("Provider registered — pending platform domain verification.");
      setOpen(false);
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Registration failed"),
  });

  if (!open) {
    return (
      <Button variant="outline" className="rounded-full" onClick={() => setOpen(true)}>
        + Register OIDC provider
      </Button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        execute({
          tenantSlug,
          providerId: slugify(String(form.get("providerId"))),
          domain: String(form.get("domain")).toLowerCase(),
          issuer: String(form.get("issuer")),
          clientId: String(form.get("clientId")),
          clientSecret: String(form.get("clientSecret")),
        });
      }}
      className="space-y-4 rounded-xl border border-border p-4"
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="providerId">Provider id</Label>
          <Input id="providerId" name="providerId" required placeholder="acme-okta" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="domain">Email domain</Label>
          <Input id="domain" name="domain" required placeholder="acme.com" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="issuer">Issuer URL (OIDC discovery)</Label>
        <Input
          id="issuer"
          name="issuer"
          type="url"
          required
          placeholder="https://acme.okta.com"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="clientId">Client ID</Label>
          <Input id="clientId" name="clientId" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="clientSecret">Client secret</Label>
          <Input id="clientSecret" name="clientSecret" type="password" required />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={isPending} className="rounded-full">
          {isPending ? "Registering…" : "Register provider"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="rounded-full"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Redirect URI for your IdP: {env.NEXT_PUBLIC_APP_URL}
        /api/auth/sso/callback/&lt;provider-id&gt;. SAML support lands next — OIDC
        covers Okta, Entra ID, Google Workspace, and JumpCloud today.
      </p>
    </form>
  );
}

export function SsoRemoveButton({
  tenantSlug,
  providerId,
}: {
  tenantSlug: string;
  providerId: string;
}) {
  const { execute, isPending } = useAction(removeOrgSsoProvider, {
    onSuccess: () => toast.success("Provider removed"),
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="rounded-full"
      disabled={isPending}
      onClick={() => {
        if (window.confirm("Remove this SSO provider? Members can still sign in with email."))
          execute({ tenantSlug, providerId });
      }}
    >
      ✕
    </Button>
  );
}
