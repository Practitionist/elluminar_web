"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { db } from "@/lib/db";
import { generateReport } from "@/lib/enterprise/reports";
import { tenantActionClient } from "@/lib/safe-action";
import { requestReportSchema } from "@/lib/validation/enterprise";

export const requestReport = tenantActionClient(["owner", "admin"])
  .inputSchema(requestReportSchema)
  .action(async ({ parsedInput, ctx }) => {
    const report = await db.reportExport.create({
      data: {
        tenantId: ctx.tenant.id,
        kind: parsedInput.kind,
        params: parsedInput.programCohortId
          ? { programCohortId: parsedInput.programCohortId }
          : {},
        requestedById: ctx.session.user.id,
      },
    });

    // Generate after the response streams; the daily cron re-runs stale
    // QUEUED rows as the safety net if after() is cut short on the platform.
    after(async () => {
      await generateReport(report.id).catch((err) =>
        console.error("[report generation]", err),
      );
    });

    revalidatePath(`/org/${ctx.tenant.slug}/reports`);
    return { reportId: report.id };
  });
