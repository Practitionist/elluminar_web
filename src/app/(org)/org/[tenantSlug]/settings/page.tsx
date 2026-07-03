import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireTenantMember } from "@/lib/auth/session";
import { db } from "@/lib/db";

import { SsoProviderForm, SsoRemoveButton } from "./sso-provider-form";

export const metadata = { title: "Organization settings" };

export default async function OrgSettingsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantMember(tenantSlug, ["owner", "admin"]);

  const providers = await db.ssoProvider.findMany({
    where: { organizationId: tenant.organizationId },
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Single sign-on for your workforce — members land in your organization
          automatically and roster seats activate on first SSO sign-in.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">SSO providers (OIDC)</CardTitle>
          <CardDescription>
            Register your identity provider. Domain-based sign-in activates once
            the platform team verifies domain ownership.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {providers.length > 0 && (
            <div className="space-y-2">
              {providers.map((p) => (
                <div
                  key={p.providerId}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-mono font-medium">{p.providerId}</span>
                    <span className="text-muted-foreground"> · {p.domain}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={p.domainVerified ? "default" : "secondary"}>
                      {p.domainVerified ? "domain verified" : "pending verification"}
                    </Badge>
                    <SsoRemoveButton tenantSlug={tenantSlug} providerId={p.providerId} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <SsoProviderForm tenantSlug={tenantSlug} />
        </CardContent>
      </Card>
    </div>
  );
}
