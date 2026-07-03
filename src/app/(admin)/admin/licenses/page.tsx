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
import { formatMoney } from "@/lib/money";

import { LicenseAdminButtons } from "./license-admin-buttons";

export const metadata = { title: "Enterprise licenses" };

export default async function AdminLicensesPage() {
  const licenses = await db.orgLicense.findMany({
    orderBy: { endsAt: "asc" },
    include: {
      tenant: { select: { displayName: true, slug: true, type: true } },
      program: { select: { title: true } },
      payments: { select: { amountMinor: true } },
    },
  });

  const now = new Date();
  const soon = new Date(now.getTime() + 60 * 86400_000);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Enterprise licenses</h1>
        <p className="text-sm text-muted-foreground">
          Record contract payments (activates drafts). Licenses ending within 60
          days are flagged for renewal.
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Organization</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead>Window</TableHead>
            <TableHead>Value / paid</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {licenses.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                No licenses yet.
              </TableCell>
            </TableRow>
          ) : (
            licenses.map((l) => {
              const paid = l.payments.reduce((s, p) => s + p.amountMinor, 0n);
              const renewalDue = l.status === "ACTIVE" && l.endsAt < soon;
              return (
                <TableRow key={l.id}>
                  <TableCell>
                    <div className="font-medium">{l.tenant.displayName}</div>
                    <div className="text-xs text-muted-foreground">
                      {l.tenant.type.toLowerCase()} · /org/{l.tenant.slug}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{l.kind.toLowerCase().replace("_", " ")}</Badge>
                    {l.program && (
                      <div className="text-xs text-muted-foreground">{l.program.title}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {l.startsAt.toLocaleDateString("en-IN", { dateStyle: "medium" })} →{" "}
                    {l.endsAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}
                    {renewalDue && (
                      <Badge variant="destructive" className="ml-2">
                        renewal due
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {l.contractValueMinor ? formatMoney(l.contractValueMinor) : "—"}
                    {paid > 0n && (
                      <div className="text-xs text-muted-foreground">
                        paid {formatMoney(paid)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={l.status === "ACTIVE" ? "default" : "secondary"}>
                      {l.status.toLowerCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <LicenseAdminButtons
                      licenseId={l.id}
                      status={l.status}
                      suggestedRupees={
                        l.contractValueMinor ? Number(l.contractValueMinor) / 100 : undefined
                      }
                    />
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
