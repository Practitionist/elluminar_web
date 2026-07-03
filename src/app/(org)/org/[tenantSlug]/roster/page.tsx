import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireTenantMember } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { tenantLabels } from "@/lib/enterprise/labels";

import { RosterImportForm } from "./roster-import-form";
import { SeatActionButtons } from "./seat-action-buttons";

export const metadata = { title: "Roster" };

export default async function RosterPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantMember(tenantSlug, ["owner", "admin"]);
  const labels = tenantLabels(tenant.type);

  const licenses = await db.orgLicense.findMany({
    where: { tenantId: tenant.id, kind: { not: "CREDIT_POOL" } },
    orderBy: { createdAt: "desc" },
    include: {
      program: { select: { title: true } },
      seatsAssigned: {
        orderBy: { assignedAt: "desc" },
        include: { user: { select: { name: true, email: true } } },
      },
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{labels.members} roster</h1>
        <p className="text-sm text-muted-foreground">
          Import a CSV (email,name) per license. Seats activate automatically
          when the invitee signs in with a verified matching email — including
          via SSO.
        </p>
      </div>

      {licenses.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Create a seat-based license first — rosters attach to licenses.
        </p>
      ) : (
        licenses.map((license) => {
          const active = license.seatsAssigned.filter((s) => s.status !== "REVOKED");
          return (
            <Card key={license.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {license.kind === "PROGRAM"
                        ? `Program: ${license.program?.title ?? "—"}`
                        : "Catalog seats"}
                    </CardTitle>
                    <CardDescription>
                      {active.length} / {license.seats} seats ·{" "}
                      {license.status.toLowerCase()}
                    </CardDescription>
                  </div>
                  <RosterImportForm tenantSlug={tenantSlug} licenseId={license.id} />
                </div>
              </CardHeader>
              <CardContent>
                {license.seatsAssigned.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No seats yet — import a roster.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{labels.member}</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Since</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {license.seatsAssigned.map((seat) => (
                        <TableRow key={seat.id}>
                          <TableCell>
                            <div className="font-medium">
                              {seat.user?.name ?? seat.inviteEmail}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {seat.user?.email ?? "invited — not signed up yet"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                seat.status === "ACTIVATED"
                                  ? "default"
                                  : seat.status === "INVITED"
                                    ? "outline"
                                    : "secondary"
                              }
                            >
                              {seat.status.toLowerCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {(seat.activatedAt ?? seat.assignedAt).toLocaleDateString("en-IN", {
                              dateStyle: "medium",
                            })}
                          </TableCell>
                          <TableCell className="text-right">
                            {seat.status !== "REVOKED" && (
                              <SeatActionButtons tenantSlug={tenantSlug} seatId={seat.id} />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
