"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { ActionError, adminActionClient, authActionClient } from "@/lib/safe-action";

export const applyAsMentor = authActionClient
  .inputSchema(
    z.object({
      headline: z.string().min(10).max(160),
      bio: z.string().min(30).max(4000),
      expertiseTags: z.array(z.string().min(1).max(30)).min(1).max(10),
      level: z.enum(["ASSOCIATE", "SENIOR", "PRINCIPAL"]).default("ASSOCIATE"),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const existing = await db.mentorProfile.findUnique({
      where: { userId: ctx.session.user.id },
    });
    if (existing) throw new ActionError("You already have a mentor profile.");

    await db.mentorProfile.create({
      data: {
        userId: ctx.session.user.id,
        headline: parsedInput.headline,
        bio: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: parsedInput.bio }] }] },
        expertiseTags: parsedInput.expertiseTags,
        level: parsedInput.level,
        status: "APPLIED",
      },
    });
    revalidatePath("/mentor");
    return { ok: true };
  });

export const vetMentor = adminActionClient
  .inputSchema(
    z.object({
      mentorProfileId: z.string().min(1),
      decision: z.enum(["ACTIVE", "SUSPENDED"]),
      level: z.enum(["ASSOCIATE", "SENIOR", "PRINCIPAL"]).optional(),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const profile = await db.mentorProfile.findUnique({
      where: { id: parsedInput.mentorProfileId },
    });
    if (!profile) throw new ActionError("Mentor not found.");
    await db.mentorProfile.update({
      where: { id: profile.id },
      data: {
        status: parsedInput.decision,
        level: parsedInput.level ?? profile.level,
        vettedById: ctx.session.user.id,
        vettedAt: new Date(),
      },
    });
    await db.notification.create({
      data: {
        userId: profile.userId,
        category: "mentor",
        title:
          parsedInput.decision === "ACTIVE"
            ? "You're approved as a mentor 🎉"
            : "Mentor application update",
        body:
          parsedInput.decision === "ACTIVE"
            ? "Your mentor workspace is live — assignments will start flowing."
            : "Your application wasn't approved at this time.",
        actionUrl: "/mentor",
      },
    });
    revalidatePath("/admin/mentors");
    return { ok: true };
  });

/**
 * Admin assigns a mentor and schedules kickoff — setting mentorKickoffAt,
 * which is the project refund cutoff.
 */
export const assignMentorToInstance = adminActionClient
  .inputSchema(
    z.object({
      projectInstanceId: z.string().min(1),
      mentorProfileId: z.string().min(1),
      kickoffAt: z.coerce.date(),
    }),
  )
  .action(async ({ parsedInput }) => {
    const [instance, mentor] = await Promise.all([
      db.projectInstance.findUnique({
        where: { id: parsedInput.projectInstanceId },
        include: { project: true },
      }),
      db.mentorProfile.findUnique({
        where: { id: parsedInput.mentorProfileId },
        include: {
          assignments: { where: { unassignedAt: null } },
        },
      }),
    ]);
    if (!instance || instance.status !== "PENDING_KICKOFF") {
      throw new ActionError("Instance not found or already kicked off.");
    }
    if (!mentor || mentor.status !== "ACTIVE") {
      throw new ActionError("Mentor not available.");
    }
    if (mentor.assignments.length >= mentor.maxActiveInstances) {
      throw new ActionError("Mentor is at capacity.");
    }
    if (parsedInput.kickoffAt < new Date()) {
      throw new ActionError("Kickoff must be in the future.");
    }

    await db.$transaction([
      db.mentorAssignment.create({
        data: {
          projectInstanceId: instance.id,
          mentorProfileId: mentor.id,
          role: "PRIMARY",
        },
      }),
      db.projectInstance.update({
        where: { id: instance.id },
        data: {
          status: "IN_PROGRESS",
          mentorKickoffAt: parsedInput.kickoffAt,
          startedAt: new Date(),
          dueAt: new Date(
            parsedInput.kickoffAt.getTime() +
              instance.project.durationWeeksMax * 7 * 86400_000,
          ),
        },
      }),
      db.notification.create({
        data: {
          userId: instance.userId,
          category: "project",
          title: "Your mentor is assigned 🚀",
          body: `Kickoff for “${instance.project.title}” is ${parsedInput.kickoffAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}. Refunds close at kickoff.`,
          actionUrl: `/learn/projects/${instance.id}`,
        },
      }),
      db.notification.create({
        data: {
          userId: mentor.userId,
          category: "mentor",
          title: "New project assignment",
          body: `You're the primary mentor for “${instance.project.title}”.`,
          actionUrl: `/mentor/instances/${instance.id}`,
        },
      }),
    ]);

    revalidatePath("/admin/projects");
    return { ok: true };
  });
