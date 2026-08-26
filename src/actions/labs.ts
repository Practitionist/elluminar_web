"use server";

import { z } from "zod";

import { isFermionConfigured } from "@/lib/fermion/client";
import { buildLabEmbedUrl, recordSandboxSession } from "@/lib/fermion/labs";
import { ensureFermionUser } from "@/lib/fermion/users";
import { ActionError, authActionClient } from "@/lib/safe-action";
import { resolveCourseAccess } from "@/lib/commerce/entitlements";
import { db } from "@/lib/db";
import { isLessonUnlocked } from "@/lib/learning/lesson-access";

export const launchCodeLabSchema = z.object({
  courseId: z.string().min(1),
  lessonId: z.string().min(1),
});

export type LaunchCodeLabResult =
  | { status: "ok"; embedUrl: string }
  | { status: "unconfigured" }
  | { status: "no_lab" };

/**
 * Launches an embedded Fermion code lab for a lesson the learner is entitled
 * to. The embed URL carries a short-lived JWT ({labId, userId}) signed with
 * the school API key; the launch itself is metered as a SandboxSession.
 */
export const launchCodeLab = authActionClient
  .inputSchema(launchCodeLabSchema)
  .action(async ({ parsedInput, ctx }): Promise<LaunchCodeLabResult> => {
    const lesson = await db.lesson.findUnique({ where: { id: parsedInput.lessonId } });
    if (!lesson || lesson.courseId !== parsedInput.courseId) {
      throw new ActionError("Lesson not found.");
    }

    const { access, enrollment } = await resolveCourseAccess(
      ctx.session.user.id,
      parsedInput.courseId,
    );
    if (!access || !enrollment) {
      throw new ActionError("You don't have access to this course.");
    }
    const { unlocked } = isLessonUnlocked(lesson, enrollment);
    if (!unlocked) {
      throw new ActionError("This lesson is still locked.");
    }

    if (!isFermionConfigured()) return { status: "unconfigured" };

    const labRef = (lesson.labConfig as { labRef?: string } | null)?.labRef;
    if (!labRef) return { status: "no_lab" };

    // Best-effort identity mapping so webhook lab results attribute to this
    // user; the embed itself works even if provisioning hiccups.
    await ensureFermionUser(ctx.session.user.id).catch(() => undefined);

    await recordSandboxSession({
      userId: ctx.session.user.id,
      lessonId: lesson.id,
      kind: "INTERACTIVE_LAB",
      providerRef: labRef,
    });

    return {
      status: "ok",
      embedUrl: buildLabEmbedUrl({
        labId: labRef,
        userId: ctx.session.user.id,
        kind: "INTERACTIVE_LAB",
      }),
    };
  });
