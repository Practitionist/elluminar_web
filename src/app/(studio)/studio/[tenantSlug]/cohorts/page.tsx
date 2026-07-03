import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireTenantMember } from "@/lib/auth/session";
import { db } from "@/lib/db";

import { ScheduleSessionDialog } from "./schedule-session-dialog";

export const metadata = { title: "Cohorts & live sessions" };

export default async function StudioCohortsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantMember(tenantSlug);

  const cohorts = await db.cohort.findMany({
    where: { course: { tenantId: tenant.id } },
    orderBy: { startsAt: "desc" },
    include: {
      course: { select: { id: true, title: true } },
      _count: { select: { enrollments: true } },
      liveSessions: {
        orderBy: { scheduledStartAt: "asc" },
        where: { status: { in: ["SCHEDULED", "LIVE"] } },
      },
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Cohorts & live sessions</h1>
      {cohorts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No cohorts yet — schedule one from a course&apos;s Cohorts tab.
        </p>
      ) : (
        cohorts.map((cohort) => (
          <Card key={cohort.id}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">
                  {cohort.course.title} — {cohort.name}
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {cohort.startsAt.toLocaleDateString("en-IN", { dateStyle: "medium" })} ·{" "}
                  {cohort._count.enrollments} enrolled
                  {cohort.capacity ? ` / ${cohort.capacity}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{cohort.status.toLowerCase()}</Badge>
                <ScheduleSessionDialog tenantSlug={tenantSlug} cohortId={cohort.id} />
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              {cohort.liveSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming sessions.</p>
              ) : (
                cohort.liveSessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{s.title}</span>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      {s.scheduledStartAt.toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                      {s.joinUrl && (
                        <Link href={s.joinUrl} target="_blank" className="text-foreground underline">
                          link
                        </Link>
                      )}
                      <Badge variant="outline">{s.provider.toLowerCase()}</Badge>
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
