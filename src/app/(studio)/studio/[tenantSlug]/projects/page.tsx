import Link from "next/link";

import { Pill, type PillTone } from "@/components/shared";
import { Button } from "@/components/ui/button";
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
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Projects" };

const STATUS_TONE: Record<string, PillTone> = {
  PUBLISHED: "success",
  IN_REVIEW: "distinction",
  DRAFT: "neutral",
  UNLISTED: "neutral",
  ARCHIVED: "neutral",
};

export default async function StudioProjectsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantMember(tenantSlug);

  const projects = await db.project.findMany({
    where: { tenantId: tenant.id },
    orderBy: { updatedAt: "desc" },
    include: {
      prices: { where: { active: true, currency: "INR", mentorLevel: null } },
      _count: { select: { instances: true, milestones: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
          Mentor-guided projects
        </h1>
        <Button
          render={<Link href={`/studio/${tenantSlug}/projects/new`} />}
          className="rounded-full"
        >
          New project
        </Button>
      </div>
      {projects.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No projects yet — projects are your highest-signal (and highest-priced) offering.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sales</TableHead>
                <TableHead>Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link
                      href={`/studio/${tenantSlug}/projects/${p.id}`}
                      className="font-bold hover:underline"
                    >
                      {p.title}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {p._count.milestones} milestones
                    </div>
                  </TableCell>
                  <TableCell>
                    <Pill tone="distinction">{p.tier.toLowerCase()}</Pill>
                  </TableCell>
                  <TableCell>
                    <Pill tone={STATUS_TONE[p.status] ?? "neutral"}>
                      {p.status.toLowerCase().replace("_", " ")}
                    </Pill>
                  </TableCell>
                  <TableCell>{p._count.instances}</TableCell>
                  <TableCell>
                    {p.prices[0] ? formatMoney(p.prices[0].amountMinor) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
