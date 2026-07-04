import Link from "next/link";

import { Pill, type PillTone } from "@/components/shared";
import { requireTenantMember } from "@/lib/auth/session";
import { db } from "@/lib/db";

import { ScheduleSessionDialog } from "./schedule-session-dialog";

export const metadata = { title: "Cohorts & live sessions" };

const STATUS_TONE: Record<string, PillTone> = {
  DRAFT: "neutral",
  OPEN: "success",
  RUNNING: "info",
  COMPLETED: "neutral",
  CANCELLED: "destructive",
};

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
      <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
        Cohorts & live sessions
      </h1>
      {cohorts.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No cohorts yet — schedule one from a course&apos;s Cohorts tab.
        </div>
      ) : (
        <div className="space-y-4">
          {cohorts.map((cohort) => (
            <div key={cohort.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-base font-extrabold">
                    {cohort.course.title} — {cohort.name}
                  </div>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">
                    {cohort.startsAt.toLocaleDateString("en-IN", { dateStyle: "medium" })} ·{" "}
                    {cohort._count.enrollments} enrolled
                    {cohort.capacity ? ` / ${cohort.capacity}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Pill tone={STATUS_TONE[cohort.status] ?? "neutral"}>
                    {cohort.status.toLowerCase()}
                  </Pill>
                  <ScheduleSessionDialog tenantSlug={tenantSlug} cohortId={cohort.id} />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {cohort.liveSessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No upcoming sessions.</p>
                ) : (
                  cohort.liveSessions.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5 text-sm"
                    >
                      <span className="font-semibold">{s.title}</span>
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
                        <Pill tone="neutral">{s.provider.toLowerCase()}</Pill>
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
