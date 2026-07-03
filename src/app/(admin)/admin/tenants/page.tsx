import { Badge } from "@/components/ui/badge";
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
        <h1 className="text-2xl font-semibold tracking-tight">Tenant approvals</h1>
        <CreateEnterpriseDialog />
      </div>
      {tenants.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pending applications.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>School</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>About</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.map((t) => {
              const owner = t.organization.members[0]?.user;
              return (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{t.displayName}</span>
                      <Badge variant="outline">{t.type.toLowerCase()}</Badge>
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
                    <Badge variant="secondary">{t.status.toLowerCase()}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <TenantReviewButtons tenantId={t.id} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
