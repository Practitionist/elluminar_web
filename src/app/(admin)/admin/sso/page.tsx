import { Pill } from "@/components/shared";
import { db } from "@/lib/db";

import { DomainVerifyToggle } from "./domain-verify-toggle";

export const metadata = { title: "SSO providers" };

export default async function AdminSsoPage() {
  const providers = await db.ssoProvider.findMany({
    include: { organization: { select: { name: true, slug: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
          SSO providers
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Verify domain ownership before enabling domain-based sign-in — an
          unverified domain must never auto-provision members.
        </p>
      </div>
      <div className="space-y-2">
        {providers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No providers registered.</p>
        ) : (
          providers.map((p) => (
            <div
              key={p.providerId}
              className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm"
            >
              <div>
                <span className="font-mono font-medium">{p.providerId}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {p.domain} · {p.organization?.name ?? "no org"}
                </span>
                <div className="mt-1">
                  <Pill tone={p.domainVerified ? "success" : "distinction"}>
                    {p.domainVerified ? "verified" : "unverified"}
                  </Pill>
                </div>
              </div>
              <DomainVerifyToggle providerId={p.providerId} verified={p.domainVerified} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
