import { Pill } from "@/components/shared";
import { requireTenantMember } from "@/lib/auth/session";
import { db } from "@/lib/db";

import { SsoConnectionDetails } from "./sso-connection-details";
import { SsoProviderForm, SsoRemoveButton } from "./sso-provider-form";

export const metadata = { title: "Organization settings" };

/**
 * `samlConfig` / `oidcConfig` are stored as JSON strings and hold the client
 * secret and private keys — never send them to the browser. We only need to
 * know *which* protocol a provider speaks, so derive a boolean here.
 */
function protocolOf(provider: {
  samlConfig: string | null;
  oidcConfig: string | null;
}): "oidc" | "saml" {
  return provider.samlConfig ? "saml" : "oidc";
}

export default async function OrgSettingsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantMember(tenantSlug, ["owner", "admin"]);

  const providers = await db.ssoProvider.findMany({
    where: { organizationId: tenant.organizationId },
    select: {
      providerId: true,
      domain: true,
      domainVerified: true,
      samlConfig: true,
      oidcConfig: true,
    },
    orderBy: { providerId: "asc" },
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
        <div className="text-base font-extrabold">Single sign-on</div>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect your identity provider over OpenID Connect or SAML 2.0.
          Sign-ins stay disabled until you verify you own the email domain.
        </p>

        <div className="mt-4 space-y-4">
          {providers.map((p) => (
            <details
              key={p.providerId}
              className="rounded-xl border border-border"
              // Anything still unverified is the thing the admin came here to
              // finish, so it opens on its own.
              open={!p.domainVerified}
            >
              <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <span className="font-mono font-bold">{p.providerId}</span>
                  <span className="text-muted-foreground"> · {p.domain}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Pill tone="neutral">{protocolOf(p) === "saml" ? "SAML" : "OIDC"}</Pill>
                  <Pill tone={p.domainVerified ? "success" : "distinction"}>
                    {p.domainVerified ? "domain verified" : "pending verification"}
                  </Pill>
                  <SsoRemoveButton tenantSlug={tenantSlug} providerId={p.providerId} />
                </div>
              </summary>
              <div className="border-t border-border p-3">
                <SsoConnectionDetails
                  tenantSlug={tenantSlug}
                  providerId={p.providerId}
                  domain={p.domain}
                  protocol={protocolOf(p)}
                  domainVerified={p.domainVerified}
                />
              </div>
            </details>
          ))}

          <SsoProviderForm tenantSlug={tenantSlug} />
        </div>
      </div>
    </div>
  );
}
