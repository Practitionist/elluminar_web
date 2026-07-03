"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { plainTextToTiptap } from "@/lib/richtext";
import { ActionError, authActionClient } from "@/lib/safe-action";

async function requireEnrolled(userId: string, courseId: string) {
  const enrollment = await db.enrollment.findFirst({
    where: { userId, courseId, status: { in: ["ACTIVE", "COMPLETED"] } },
  });
  if (!enrollment) throw new ActionError("Join the course to participate.");
  return enrollment;
}

export const createThread = authActionClient
  .inputSchema(
    z.object({
      courseId: z.string().min(1),
      title: z.string().min(5).max(200),
      body: z.string().min(5).max(10000),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    await requireEnrolled(ctx.session.user.id, parsedInput.courseId);
    const thread = await db.discussionThread.create({
      data: {
        scopeType: "COURSE",
        courseId: parsedInput.courseId,
        authorId: ctx.session.user.id,
        title: parsedInput.title,
        body: plainTextToTiptap(parsedInput.body),
        kind: "QUESTION",
      },
    });
    revalidatePath(`/learn/courses/${parsedInput.courseId}/discussions`);
    return { threadId: thread.id };
  });

export const replyToThread = authActionClient
  .inputSchema(
    z.object({
      threadId: z.string().min(1),
      body: z.string().min(2).max(10000),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const thread = await db.discussionThread.findUnique({
      where: { id: parsedInput.threadId },
      include: { course: { include: { tenant: { select: { organizationId: true } } } } },
    });
    if (!thread || thread.status === "LOCKED" || thread.status === "REMOVED") {
      throw new ActionError("Thread is not open.");
    }
    if (thread.courseId) {
      const isInstructor = thread.course
        ? await db.member.findUnique({
            where: {
              organizationId_userId: {
                organizationId: thread.course.tenant.organizationId,
                userId: ctx.session.user.id,
              },
            },
          })
        : null;
      if (!isInstructor) await requireEnrolled(ctx.session.user.id, thread.courseId);
    }

    await db.$transaction([
      db.discussionPost.create({
        data: {
          threadId: thread.id,
          authorId: ctx.session.user.id,
          body: plainTextToTiptap(parsedInput.body),
        },
      }),
      db.discussionThread.update({
        where: { id: thread.id },
        data: { replyCount: { increment: 1 }, lastActivityAt: new Date() },
      }),
    ]);

    if (thread.authorId !== ctx.session.user.id) {
      await db.notification.create({
        data: {
          userId: thread.authorId,
          category: "discussion",
          title: "New reply to your question",
          body: thread.title,
          actionUrl: `/learn/courses/${thread.courseId}/discussions/${thread.id}`,
        },
      });
    }

    revalidatePath(`/learn/courses/${thread.courseId}/discussions/${thread.id}`);
    return { ok: true };
  });

export const acceptAnswer = authActionClient
  .inputSchema(z.object({ threadId: z.string().min(1), postId: z.string().min(1) }))
  .action(async ({ parsedInput, ctx }) => {
    const thread = await db.discussionThread.findUnique({
      where: { id: parsedInput.threadId },
    });
    if (!thread || thread.authorId !== ctx.session.user.id) {
      throw new ActionError("Only the author can accept an answer.");
    }
    await db.$transaction([
      db.discussionPost.updateMany({
        where: { threadId: thread.id },
        data: { isAccepted: false },
      }),
      db.discussionPost.update({
        where: { id: parsedInput.postId },
        data: { isAccepted: true },
      }),
      db.discussionThread.update({
        where: { id: thread.id },
        data: { status: "RESOLVED", acceptedPostId: parsedInput.postId },
      }),
    ]);
    revalidatePath(`/learn/courses/${thread.courseId}/discussions/${thread.id}`);
    return { ok: true };
  });
