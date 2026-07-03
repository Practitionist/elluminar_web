import "server-only";

import { db } from "@/lib/db";
import { isStorageConfigured, STORAGE_BUCKETS, uploadBufferAsAsset } from "@/lib/storage";

/** Minimal CSV escaping (quotes + commas + newlines). */
function csvEscape(value: unknown): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(headers: string[], rows: Array<Array<unknown>>): string {
  return [headers, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
}

/**
 * Async report generation (COMPLETION/ENGAGEMENT now; COMPLIANCE/SKILL_GAP
 * share the engine post-pilot). CSV first — XLSX is deliberately post-MVP.
 * Idempotent: safe for the cron to re-run stale QUEUED rows.
 */
export async function generateReport(reportExportId: string) {
  const report = await db.reportExport.findUnique({ where: { id: reportExportId } });
  if (!report || report.status === "READY") return report;

  await db.reportExport.update({
    where: { id: reportExportId },
    data: { status: "RUNNING" },
  });

  try {
    let csv: string;
    if (report.kind === "COMPLETION" || report.kind === "COMPLIANCE") {
      const enrollments = await db.programEnrollment.findMany({
        where: { programCohort: { program: { ownerTenantId: report.tenantId } } },
        include: {
          user: { select: { name: true, email: true } },
          programCohort: { include: { program: { select: { title: true } } } },
          enrollments: {
            include: { course: { select: { title: true } } },
          },
          projectInstances: {
            include: { project: { select: { title: true } } },
          },
        },
      });
      csv = toCsv(
        ["Learner", "Email", "Program", "Cohort", "Status", "Completed at", "Items detail"],
        enrollments.map((pe) => [
          pe.user.name,
          pe.user.email,
          pe.programCohort.program.title,
          pe.programCohort.name,
          pe.status,
          pe.completedAt?.toISOString() ?? "",
          [
            ...pe.enrollments.map(
              (e) =>
                `${e.course.title}: ${e.completedAt ? "completed" : `${Math.round(e.progressPct)}%`}`,
            ),
            ...pe.projectInstances.map(
              (i) => `${i.project.title}: ${i.status.toLowerCase()}`,
            ),
          ].join(" | "),
        ]),
      );
    } else {
      // ENGAGEMENT / SKILL_GAP (v1: activity roll; skill-gap aggregates post-pilot)
      const enrollments = await db.enrollment.findMany({
        where: {
          OR: [
            { orgLicense: { tenantId: report.tenantId } },
            {
              programEnrollment: {
                programCohort: { program: { ownerTenantId: report.tenantId } },
              },
            },
          ],
        },
        include: {
          user: { select: { name: true, email: true } },
          course: { select: { title: true } },
        },
        orderBy: { lastActivityAt: { sort: "desc", nulls: "last" } },
      });
      csv = toCsv(
        ["Learner", "Email", "Course", "Source", "Progress %", "Last activity", "Status"],
        enrollments.map((e) => [
          e.user.name,
          e.user.email,
          e.course.title,
          e.source,
          Math.round(e.progressPct),
          e.lastActivityAt?.toISOString() ?? "",
          e.status,
        ]),
      );
    }

    let fileAssetId: string | null = null;
    if (isStorageConfigured()) {
      const asset = await uploadBufferAsAsset({
        tenantId: report.tenantId,
        bucket: STORAGE_BUCKETS.submissions,
        filename: `${report.kind.toLowerCase()}-${reportExportId.slice(-6)}.csv`,
        mime: "text/csv",
        buffer: Buffer.from(csv, "utf-8"),
        kind: "DOCUMENT",
      });
      fileAssetId = asset.id;
    }

    return db.reportExport.update({
      where: { id: reportExportId },
      data: {
        status: "READY",
        fileAssetId,
        completedAt: new Date(),
        // Inline payload keeps reports usable before Supabase Storage is configured.
        params: {
          ...(report.params as object),
          rowCount: csv.split("\n").length - 1,
          ...(fileAssetId ? {} : { inlineCsv: csv.slice(0, 200_000) }),
        },
      },
    });
  } catch (err) {
    await db.reportExport.update({
      where: { id: reportExportId },
      data: {
        status: "FAILED",
        params: {
          ...(report.params as object),
          error: err instanceof Error ? err.message : String(err),
        },
      },
    });
    throw err;
  }
}
