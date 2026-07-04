import { Pill, type PillTone } from "@/components/shared";
import { requireTenantMember } from "@/lib/auth/session";
import { db } from "@/lib/db";

import { InviteMemberForm } from "./invite-member-form";

export const metadata = { title: "Team" };

const ROLE_TONE: Record<string, PillTone> = {
  owner: "primary",
  admin: "distinction",
  instructor: "info",
  member: "neutral",
};

export default async function StudioMembersPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantMember(tenantSlug);

  const [members, invitations] = await Promise.all([
    db.member.findMany({
      where: { organizationId: tenant.organizationId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.invitation.findMany({
      where: { organizationId: tenant.organizationId, status: "pending" },
      orderBy: { expiresAt: "asc" },
    }),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
          Team
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Owners manage everything; admins manage content and commerce;
          instructors author and teach.
        </p>
      </div>

      <InviteMemberForm organizationId={tenant.organizationId} />

      <div className="space-y-2">
        {members.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm"
          >
            <div>
              <div className="font-bold">{m.user.name}</div>
              <div className="text-xs text-muted-foreground">{m.user.email}</div>
            </div>
            <Pill tone={ROLE_TONE[m.role] ?? "neutral"}>{m.role}</Pill>
          </div>
        ))}
        {invitations.map((i) => (
          <div
            key={i.id}
            className="flex items-center justify-between rounded-xl border border-dashed border-border px-4 py-3 text-sm"
          >
            <div className="text-muted-foreground">{i.email}</div>
            <Pill tone="neutral">invited · {i.role ?? "member"}</Pill>
          </div>
        ))}
      </div>
    </div>
  );
}
