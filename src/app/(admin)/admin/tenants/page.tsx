import { Pill, type PillTone } from "@/components/shared";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";
import { tiptapToPlainText } from "@/lib/richtext";

import { CreateEnterpriseDialog } from "./create-enterprise-dialog";
import { TenantReviewButtons } from "./tenant-review-buttons";

export const metadata = { title: "Tenant approvals" };

const TENANT_STATUS_TONE: Record<string, PillTone> = {
  APPLIED: "distinction",
  IN_REVIEW: "info",
  APPROVED: "success",
  SUSPENDED: "destructive",
  ARCHIVED: "neutral",
};

export default async function AdminTenantsPage() {
  const tenants = await db.tenant.findMany({
    where: { status: { in: ["APPLIED", "IN_REVIEW", "SUSPENDED"] } },
    orderBy: { appliedAt: "asc" },
    include: {
      organization: {
        select: {
          members: {
            where: { role: "owner" },
            select: { user: { select: { name: true, email: true } } },
          },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
          Tenant approvals
        </h1>
        <CreateEnterpriseDialog />
      </div>
      {tenants.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pending applications.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-bold uppercase text-muted-foreground">
                  School
                </TableHead>
                <TableHead className="text-xs font-bold uppercase text-muted-foreground">
                  Owner
                </TableHead>
                <TableHead className="text-xs font-bold uppercase text-muted-foreground">
                  About
                </TableHead>
                <TableHead className="text-xs font-bold uppercase text-muted-foreground">
                  Status
                </TableHead>
                <TableHead className="text-right text-xs font-bold uppercase text-muted-foreground">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((t) => {
                const owner = t.organization.members[0]?.user;
                return (
                  <TableRow key={t.id} className="border-t border-border">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{t.displayName}</span>
                        <Pill tone="neutral">{t.type.toLowerCase()}</Pill>
                      </div>
                      <div className="text-xs text-muted-foreground">/c/{t.slug}</div>
                    </TableCell>
                    <TableCell>
                      <div>{owner?.name}</div>
                      <div className="text-xs text-muted-foreground">{owner?.email}</div>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {tiptapToPlainText(t.about) || "—"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Pill tone={TENANT_STATUS_TONE[t.status] ?? "neutral"}>
                        {t.status.toLowerCase()}
                      </Pill>
                    </TableCell>
                    <TableCell className="text-right">
                      <TenantReviewButtons tenantId={t.id} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
