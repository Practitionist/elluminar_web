import { Badge } from "@/components/ui/badge";
import { requireTenantMember } from "@/lib/auth/session";
import { db } from "@/lib/db";

import { InviteMemberForm } from "./invite-member-form";

export const metadata = { title: "Team" };

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
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground">
          Owners manage everything; admins manage content and commerce;
          instructors author and teach.
        </p>
      </div>

      <InviteMemberForm organizationId={tenant.organizationId} />

      <div className="space-y-2">
        {members.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
          >
            <div>
              <div className="font-medium">{m.user.name}</div>
              <div className="text-xs text-muted-foreground">{m.user.email}</div>
            </div>
            <Badge variant="outline">{m.role}</Badge>
          </div>
        ))}
        {invitations.map((i) => (
          <div
            key={i.id}
            className="flex items-center justify-between rounded-md border border-dashed px-3 py-2 text-sm"
          >
            <div className="text-muted-foreground">{i.email}</div>
            <Badge variant="secondary">invited · {i.role ?? "member"}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
