import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireTenantMember } from "@/lib/auth/session";
import { db } from "@/lib/db";

import { ProgramFormDialog } from "./program-form-dialog";

export const metadata = { title: "Programs" };

export default async function OrgProgramsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantMember(tenantSlug, ["owner", "admin"]);

  const programs = await db.program.findMany({
    where: { ownerTenantId: tenant.id },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { items: true, cohorts: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Programs</h1>
          <p className="text-sm text-muted-foreground">
            Curated course sequences + optional mentor capstones, delivered in
            cohorts with a co-branded certificate.
          </p>
        </div>
        <ProgramFormDialog tenantSlug={tenantSlug} />
      </div>
      {programs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No programs yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {programs.map((p) => (
            <Link key={p.id} href={`/org/${tenantSlug}/programs/${p.id}`}>
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{p.title}</CardTitle>
                    <Badge variant={p.status === "ACTIVE" ? "default" : "outline"}>
                      {p.status.toLowerCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {p._count.items} items · {p._count.cohorts} cohorts
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
