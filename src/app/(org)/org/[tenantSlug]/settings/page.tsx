import { Pill } from "@/components/shared";
import { requireOrgTenant } from "@/lib/auth/session";
import { db } from "@/lib/db";

import { SsoProviderForm, SsoRemoveButton } from "./sso-provider-form";

export const metadata = { title: "Organization settings" };

export default async function OrgSettingsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { tenant } = await requireOrgTenant(tenantSlug, ["owner", "admin"]);

  const providers = await db.ssoProvider.findMany({
    where: { organizationId: tenant.organizationId },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Single sign-on for your workforce — members land in your organization
          automatically and roster seats activate on first SSO sign-in.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="text-base font-extrabold">SSO providers (OIDC)</div>
        <p className="mt-1 text-sm text-muted-foreground">
          Register your identity provider. Domain-based sign-in activates once
          the platform team verifies domain ownership.
        </p>
        <div className="mt-4 space-y-4">
          {providers.length > 0 && (
            <div className="space-y-2">
              {providers.map((p) => (
                <div
                  key={p.providerId}
                  className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-mono font-bold">{p.providerId}</span>
                    <span className="text-muted-foreground"> · {p.domain}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill tone={p.domainVerified ? "success" : "distinction"}>
                      {p.domainVerified ? "domain verified" : "pending verification"}
                    </Pill>
                    <SsoRemoveButton tenantSlug={tenantSlug} providerId={p.providerId} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <SsoProviderForm tenantSlug={tenantSlug} />
        </div>
      </div>
    </div>
  );
}
