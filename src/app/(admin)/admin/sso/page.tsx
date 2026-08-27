import { formatDistanceToNow } from "date-fns";

import { Pill } from "@/components/shared";
import { db } from "@/lib/db";

import { DomainVerifyToggle } from "./domain-verify-toggle";

export const metadata = { title: "SSO providers" };

/**
 * `oidcConfig` / `samlConfig` hold client secrets and private keys. We only
 * need the protocol, so derive it here and never select the payloads.
 */
function protocolOf(p: { samlConfig: string | null }): "OIDC" | "SAML" {
  return p.samlConfig ? "SAML" : "OIDC";
}

export default async function AdminSsoPage() {
  const providers = await db.ssoProvider.findMany({
    select: {
      providerId: true,
      domain: true,
      issuer: true,
      domainVerified: true,
      samlConfig: true,
      organization: { select: { name: true, slug: true } },
    },
  });

  // The queue is the point of this page: anything unverified is a customer
  // waiting on us, so it sorts first.
  const pending = providers.filter((p) => !p.domainVerified);
  const verified = providers.filter((p) => p.domainVerified);

  const auditTrail = await db.auditLog.findMany({
    where: {
      entityType: "SsoProvider",
      entityId: { in: providers.map((p) => p.providerId) },
    },
    select: { entityId: true, action: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const lastEventFor = new Map<string, { action: string; createdAt: Date }>();
  for (const entry of auditTrail) {
    if (entry.entityId && !lastEventFor.has(entry.entityId)) {
      lastEventFor.set(entry.entityId, entry);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
          SSO providers
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Organizations verify their own domains by DNS. This console is the
          override: vouch for a customer whose DNS team is slow, or revoke a
          provider we no longer trust. An unverified provider cannot
          authenticate anyone.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-bold tracking-wide text-muted-foreground uppercase">
          Awaiting verification ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing waiting. Every registered provider has verified its domain.
          </p>
        ) : (
          pending.map((p) => (
            <ProviderRow
              key={p.providerId}
              provider={p}
              lastEvent={lastEventFor.get(p.providerId)}
            />
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold tracking-wide text-muted-foreground uppercase">
          Live ({verified.length})
        </h2>
        {verified.length === 0 ? (
          <p className="text-sm text-muted-foreground">No providers are live yet.</p>
        ) : (
          verified.map((p) => (
            <ProviderRow
              key={p.providerId}
              provider={p}
              lastEvent={lastEventFor.get(p.providerId)}
            />
          ))
        )}
      </section>
    </div>
  );
}

function ProviderRow({
  provider,
  lastEvent,
}: {
  provider: {
    providerId: string;
    domain: string;
    issuer: string;
    domainVerified: boolean;
    samlConfig: string | null;
    organization: { name: string; slug: string } | null;
  };
  lastEvent?: { action: string; createdAt: Date };
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border bg-card px-4 py-3 text-sm">
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono font-medium">{provider.providerId}</span>
          <Pill tone="neutral">{protocolOf(provider)}</Pill>
          <Pill tone={provider.domainVerified ? "success" : "distinction"}>
            {provider.domainVerified ? "verified" : "unverified"}
          </Pill>
        </div>
        <p className="text-muted-foreground">
          {provider.domain} · {provider.organization?.name ?? "no organization"}
        </p>
        <p className="truncate font-mono text-xs text-muted-foreground">
          {provider.issuer}
        </p>
        {lastEvent ? (
          <p className="text-xs text-muted-foreground">
            Last event: <span className="font-medium">{lastEvent.action}</span>,{" "}
            {formatDistanceToNow(lastEvent.createdAt, { addSuffix: true })}
          </p>
        ) : null}
      </div>

      <DomainVerifyToggle
        providerId={provider.providerId}
        verified={provider.domainVerified}
      />
    </div>
  );
}
