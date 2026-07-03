import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireTenantMember } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getSignedReadUrl, isStorageConfigured } from "@/lib/storage";

import { RequestReportButtons } from "./request-report-buttons";

export const metadata = { title: "Reports" };

export default async function OrgReportsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantMember(tenantSlug, ["owner", "admin"]);

  const [cohorts, exports] = await Promise.all([
    db.programCohort.findMany({
      where: {
        program: { ownerTenantId: tenant.id },
        status: { in: ["OPEN", "RUNNING", "COMPLETED"] },
      },
      include: {
        program: {
          include: {
            items: {
              orderBy: { position: "asc" },
              include: {
                course: { select: { id: true, title: true } },
                project: { select: { id: true, title: true } },
              },
            },
          },
        },
        enrollments: {
          include: {
            user: { select: { name: true } },
            enrollments: { select: { courseId: true, completedAt: true, progressPct: true } },
            projectInstances: { select: { projectId: true, status: true } },
          },
        },
      },
      take: 5,
      orderBy: { createdAt: "desc" },
    }),
    db.reportExport.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const exportLinks = await Promise.all(
    exports.map(async (r) => ({
      ...r,
      downloadUrl:
        r.fileAssetId && isStorageConfigured()
          ? await getSignedReadUrl(r.fileAssetId).catch(() => null)
          : null,
    })),
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <RequestReportButtons tenantSlug={tenantSlug} />
      </div>

      {cohorts.map((cohort) => (
        <Card key={cohort.id}>
          <CardHeader>
            <CardTitle className="text-base">
              {cohort.program.title} — {cohort.name}
            </CardTitle>
            <CardDescription>
              {cohort.enrollments.length} learners · per-item completion
            </CardDescription>
          </CardHeader>
          <CardContent>
            {cohort.enrollments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No learners enrolled yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="py-1 pr-4">Learner</th>
                      {cohort.program.items.map((item, i) => (
                        <th key={item.id} className="px-2 py-1 text-center" title={item.course?.title ?? item.project?.title ?? ""}>
                          {i + 1}
                        </th>
                      ))}
                      <th className="px-2 py-1">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cohort.enrollments.map((pe) => (
                      <tr key={pe.id} className="border-t">
                        <td className="py-1.5 pr-4 font-medium">{pe.user.name}</td>
                        {cohort.program.items.map((item) => {
                          const done =
                            item.itemType === "COURSE"
                              ? pe.enrollments.some(
                                  (e) => e.courseId === item.courseId && e.completedAt,
                                )
                              : pe.projectInstances.some(
                                  (x) => x.projectId === item.projectId && x.status === "PASSED",
                                );
                          const inProgress =
                            !done &&
                            (item.itemType === "COURSE"
                              ? pe.enrollments.some(
                                  (e) => e.courseId === item.courseId && e.progressPct > 0,
                                )
                              : pe.projectInstances.some(
                                  (x) => x.projectId === item.projectId,
                                ));
                          return (
                            <td key={item.id} className="px-2 py-1.5 text-center">
                              <span
                                className={
                                  done
                                    ? "text-green-600"
                                    : inProgress
                                      ? "text-amber-500"
                                      : "text-muted-foreground/40"
                                }
                              >
                                {done ? "●" : inProgress ? "◐" : "○"}
                              </span>
                            </td>
                          );
                        })}
                        <td className="px-2 py-1.5">
                          <Badge
                            variant={pe.status === "COMPLETED" ? "default" : "outline"}
                          >
                            {pe.status.toLowerCase().replace("_", " ")}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Exports</CardTitle>
          <CardDescription>CSV downloads (async — refresh after requesting).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {exportLinks.length === 0 ? (
            <p className="text-muted-foreground">No exports yet.</p>
          ) : (
            exportLinks.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <span>
                  {r.kind.toLowerCase()} ·{" "}
                  {r.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                </span>
                <span className="flex items-center gap-2">
                  <Badge variant={r.status === "READY" ? "default" : "secondary"}>
                    {r.status.toLowerCase()}
                  </Badge>
                  {r.downloadUrl && (
                    <Button
                      render={<a href={r.downloadUrl} download />}
                      size="sm"
                      variant="outline"
                    >
                      Download
                    </Button>
                  )}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
