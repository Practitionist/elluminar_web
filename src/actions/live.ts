"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { isFermionConfigured } from "@/lib/fermion/client";
import { provisionFermionLiveSession } from "@/lib/fermion/live";
import { ActionError, tenantActionClient } from "@/lib/safe-action";
import { slugSchema } from "@/lib/validation/tenant";

export const scheduleLiveSession = tenantActionClient(["owner", "admin", "instructor"])
  .inputSchema(
    z.object({
      tenantSlug: slugSchema,
      cohortId: z.string().min(1),
      title: z.string().min(2).max(160),
      scheduledStartAt: z.coerce.date(),
      durationMin: z.number().int().min(15).max(480).default(90),
      joinUrl: z.url().optional().or(z.literal("")),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const cohort = await db.cohort.findUnique({
      where: { id: parsedInput.cohortId },
      include: { course: true },
    });
    if (!cohort || cohort.course.tenantId !== ctx.tenant.id) {
      throw new ActionError("Cohort not found.");
    }

    const useFermion = isFermionConfigured() && !parsedInput.joinUrl;
    const session = await db.liveSession.create({
      data: {
        tenantId: ctx.tenant.id,
        purpose: "COHORT_CLASS",
        courseId: cohort.courseId,
        cohortId: cohort.id,
        title: parsedInput.title,
        scheduledStartAt: parsedInput.scheduledStartAt,
        scheduledEndAt: new Date(
          parsedInput.scheduledStartAt.getTime() + parsedInput.durationMin * 60_000,
        ),
        provider: useFermion ? "FERMION" : "EXTERNAL_LINK",
        joinUrl: parsedInput.joinUrl || null,
        hostUserId: ctx.session.user.id,
      },
    });

    if (useFermion) {
      await provisionFermionLiveSession(session.id).catch(() => undefined);
    }

    // Notify enrolled learners (in-app; email fan-out arrives with Novu, issue #10).
    const enrollments = await db.enrollment.findMany({
      where: { cohortId: cohort.id, status: "ACTIVE" },
      select: { userId: true },
    });
    if (enrollments.length > 0) {
      await db.notification.createMany({
        data: enrollments.map((e) => ({
          userId: e.userId,
          category: "live",
          title: `Live class scheduled: ${parsedInput.title}`,
          body: `${cohort.course.title} · ${parsedInput.scheduledStartAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`,
          actionUrl: "/learn",
        })),
      });
    }

    revalidatePath(`/studio/${ctx.tenant.slug}/cohorts`);
    return { liveSessionId: session.id };
  });
