"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { writeLedgerEntry } from "@/lib/commerce/fulfillment";
import { issueProjectCredential } from "@/lib/credentials/issue";
import { applyBps } from "@/lib/money";
import { MAX_SUBMISSION_FILES } from "@/lib/learning/uploads";
import { STORAGE_BUCKETS } from "@/lib/storage";
import { ActionError, authActionClient } from "@/lib/safe-action";

/** Learner submits work for a milestone. */
export const submitMilestone = authActionClient
  .inputSchema(
    z.object({
      projectInstanceId: z.string().min(1),
      milestoneId: z.string().min(1),
      notes: z.string().max(10000).optional(),
      repoUrl: z.url().optional().or(z.literal("")),
      artifactUrl: z.url().optional().or(z.literal("")),
      mediaAssetIds: z.array(z.string().min(1)).max(MAX_SUBMISSION_FILES).optional(),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const instance = await db.projectInstance.findUnique({
      where: { id: parsedInput.projectInstanceId },
      include: { project: true },
    });
    if (!instance || instance.userId !== ctx.session.user.id) {
      throw new ActionError("Project not found.");
    }
    if (!["IN_PROGRESS", "CHANGES_REQUESTED"].includes(instance.status)) {
      throw new ActionError("This project isn't accepting submissions right now.");
    }
    const mediaAssetIds = [...new Set(parsedInput.mediaAssetIds ?? [])];
    const hasFiles = mediaAssetIds.length > 0;
    if (!parsedInput.notes && !parsedInput.repoUrl && !parsedInput.artifactUrl && !hasFiles) {
      throw new ActionError("Attach your work before submitting.");
    }

    // Validate attachments before writing anything — same ownership, bucket and
    // READY checks as assignment submissions.
    if (hasFiles) {
      const assets = await db.mediaAsset.findMany({
        where: { id: { in: mediaAssetIds } },
        select: { id: true, uploadedById: true, bucket: true, status: true },
      });
      for (const id of mediaAssetIds) {
        const asset = assets.find((a) => a.id === id);
        if (
          !asset ||
          asset.uploadedById !== ctx.session.user.id ||
          asset.bucket !== STORAGE_BUCKETS.submissions
        ) {
          throw new ActionError("One of the attached files is invalid.");
        }
        if (asset.status !== "READY") {
          throw new ActionError("Finish uploading all files first.");
        }
      }
    }

    const prior = await db.milestoneSubmission.count({
      where: { projectInstanceId: instance.id, milestoneId: parsedInput.milestoneId },
    });

    const submission = await db.$transaction(async (tx) => {
      const submission = await tx.milestoneSubmission.create({
        data: {
          projectInstanceId: instance.id,
          milestoneId: parsedInput.milestoneId,
          attemptNo: prior + 1,
          notes: parsedInput.notes
            ? { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: parsedInput.notes }] }] }
            : undefined,
          repoUrl: parsedInput.repoUrl || null,
          artifactUrl: parsedInput.artifactUrl || null,
          status: "IN_REVIEW",
          ...(hasFiles
            ? { files: { create: mediaAssetIds.map((mediaAssetId) => ({ mediaAssetId })) } }
            : {}),
        },
      });
      await tx.projectInstance.update({
        where: { id: instance.id },
        data: { status: "IN_REVIEW" },
      });

      // Open a mentor review with an SLA target from platform config.
      const slaConfig = await tx.platformConfig.findUnique({
        where: { key: "projects.reviewSlaHoursByTier" },
      });
      const slaHours =
        ((slaConfig?.value as Record<string, number>) ?? {})[instance.project.tier] ?? 72;
      const assignment = await tx.mentorAssignment.findFirst({
        where: { projectInstanceId: instance.id, unassignedAt: null, role: "PRIMARY" },
        include: { mentorProfile: true },
      });
      await tx.projectReview.create({
        data: {
          projectInstanceId: instance.id,
          milestoneSubmissionId: submission.id,
          kind: "MENTOR_CHECKPOINT",
          reviewerId: assignment?.mentorProfile.userId ?? null,
          status: "PENDING",
          turnaroundTargetAt: new Date(Date.now() + slaHours * 3600_000),
        },
      });
      if (assignment) {
        await tx.notification.create({
          data: {
            userId: assignment.mentorProfile.userId,
            category: "mentor",
            title: "Submission awaiting your review",
            body: `“${instance.project.title}” — review SLA ${slaHours}h.`,
            actionUrl: `/mentor/instances/${instance.id}`,
          },
        });
      }
      return submission;
    });

    revalidatePath(`/learn/projects/${instance.id}`);
    return { submissionId: submission.id };
  });

const rubricScoreSchema = z.object({
  rubricCriterionId: z.string().min(1),
  score: z.number().min(0),
  maxScore: z.number().min(1),
  comment: z.string().max(2000).optional(),
});

async function requireMentorOfInstance(userId: string, projectInstanceId: string) {
  const assignment = await db.mentorAssignment.findFirst({
    where: {
      projectInstanceId,
      unassignedAt: null,
      mentorProfile: { userId, status: "ACTIVE" },
    },
    include: { mentorProfile: true },
  });
  if (!assignment) throw new ActionError("You're not the mentor on this project.");
  return assignment;
}

/** Mentor completes a checkpoint review: approve or request changes. */
export const reviewMilestoneSubmission = authActionClient
  .inputSchema(
    z.object({
      projectReviewId: z.string().min(1),
      decision: z.enum(["APPROVED", "CHANGES_REQUESTED"]),
      summary: z.string().min(10).max(10000),
      overallScore: z.number().min(0).max(100).optional(),
      rubricScores: z.array(rubricScoreSchema).default([]),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const review = await db.projectReview.findUnique({
      where: { id: parsedInput.projectReviewId },
      include: {
        projectInstance: { include: { project: true } },
        milestoneSubmission: true,
      },
    });
    if (!review || review.status === "COMPLETED") {
      throw new ActionError("Review not found or already completed.");
    }
    await requireMentorOfInstance(ctx.session.user.id, review.projectInstanceId);

    await db.$transaction(async (tx) => {
      await tx.projectReview.update({
        where: { id: review.id },
        data: {
          status: "COMPLETED",
          decision: parsedInput.decision,
          reviewerId: ctx.session.user.id,
          overallScore: parsedInput.overallScore,
          summary: { text: parsedInput.summary },
          completedAt: new Date(),
        },
      });
      for (const s of parsedInput.rubricScores) {
        await tx.rubricScore.upsert({
          where: {
            projectReviewId_rubricCriterionId: {
              projectReviewId: review.id,
              rubricCriterionId: s.rubricCriterionId,
            },
          },
          update: { score: s.score, maxScore: s.maxScore, comment: s.comment },
          create: {
            projectReviewId: review.id,
            rubricCriterionId: s.rubricCriterionId,
            score: s.score,
            maxScore: s.maxScore,
            comment: s.comment,
          },
        });
      }
      if (review.milestoneSubmissionId) {
        await tx.milestoneSubmission.update({
          where: { id: review.milestoneSubmissionId },
          data: {
            status: parsedInput.decision === "APPROVED" ? "APPROVED" : "CHANGES_REQUESTED",
          },
        });
      }
      await tx.projectInstance.update({
        where: { id: review.projectInstanceId },
        data: {
          status: parsedInput.decision === "APPROVED" ? "IN_PROGRESS" : "CHANGES_REQUESTED",
        },
      });
      await tx.notification.create({
        data: {
          userId: review.projectInstance.userId,
          category: "project",
          title:
            parsedInput.decision === "APPROVED"
              ? "Milestone approved ✓"
              : "Changes requested on your milestone",
          body: parsedInput.summary.slice(0, 200),
          actionUrl: `/learn/projects/${review.projectInstanceId}`,
        },
      });
    });

    revalidatePath(`/mentor/instances/${review.projectInstanceId}`);
    return { ok: true };
  });

/**
 * Mentor's final verdict. PASS → credential + mentor fee ledger entries
 * (fee moves from the seller's earnings to the mentor, per PRD §8.3 economics).
 */
export const finalizeProjectInstance = authActionClient
  .inputSchema(
    z.object({
      projectInstanceId: z.string().min(1),
      decision: z.enum(["PASS", "FAIL"]),
      summary: z.string().min(20).max(10000),
      finalScore: z.number().min(0).max(100),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const assignment = await requireMentorOfInstance(
      ctx.session.user.id,
      parsedInput.projectInstanceId,
    );
    const instance = await db.projectInstance.findUniqueOrThrow({
      where: { id: parsedInput.projectInstanceId },
      include: { project: true, orderItem: true },
    });
    if (["PASSED", "FAILED", "REFUNDED", "WITHDRAWN"].includes(instance.status)) {
      throw new ActionError("This project is already finalized.");
    }

    // All review-checkpoint milestones must have an approved submission.
    if (parsedInput.decision === "PASS") {
      const checkpoints = await db.milestone.findMany({
        where: { projectId: instance.projectId, isReviewCheckpoint: true },
        select: { id: true },
      });
      for (const cp of checkpoints) {
        const approved = await db.milestoneSubmission.findFirst({
          where: {
            projectInstanceId: instance.id,
            milestoneId: cp.id,
            status: "APPROVED",
          },
        });
        if (!approved) {
          throw new ActionError(
            "All mentor-checkpoint milestones must be approved before a PASS.",
          );
        }
      }

      // A credential is the product; `defenseRequired` must mean something.
      // Until now the flag was decorative — a project seeded defenceRequired
      // could be PASSed with no defense ever held, so the credential would
      // assert a review step that never happened.
      if (instance.project.defenseRequired) {
        const defense = await db.projectReview.findFirst({
          where: {
            projectInstanceId: instance.id,
            kind: "DEFENSE",
            decision: { in: ["PASS", "APPROVED"] },
          },
          select: { id: true },
        });
        if (!defense) {
          throw new ActionError(
            "This project requires a live defense. Record a passing defense review before issuing a PASS.",
          );
        }
      }
    }

    await db.$transaction(async (tx) => {
      await tx.projectReview.create({
        data: {
          projectInstanceId: instance.id,
          kind: "MENTOR_FINAL",
          reviewerId: ctx.session.user.id,
          status: "COMPLETED",
          decision: parsedInput.decision,
          overallScore: parsedInput.finalScore,
          summary: { text: parsedInput.summary },
          completedAt: new Date(),
        },
      });
      await tx.projectInstance.update({
        where: { id: instance.id },
        data: {
          status: parsedInput.decision === "PASS" ? "PASSED" : "FAILED",
          completedAt: new Date(),
          finalScore: parsedInput.finalScore,
        },
      });

      // Mentor fee: payoutBps of the tier's mentor-attributable share of the
      // item's taxable revenue — moved from seller earnings to the mentor.
      if (parsedInput.decision === "PASS" && instance.orderItem) {
        const item = instance.orderItem;
        const config = await tx.platformConfig.findUnique({
          where: { key: "projects.mentorAttributableBpsByTier" },
        });
        const tierBps =
          ((config?.value as Record<string, number>) ?? {})[instance.project.tier] ?? 4000;
        const taxable = item.totalMinor - item.taxMinor;
        const mentorAttributable = applyBps(taxable, tierBps);
        const payoutBps =
          assignment.payoutBpsOverride ?? assignment.mentorProfile.defaultPayoutBps;
        const mentorFee = applyBps(mentorAttributable, payoutBps);

        if (mentorFee > 0n) {
          await writeLedgerEntry(tx, {
            account: { ownerType: "MENTOR", mentorProfileId: assignment.mentorProfileId },
            entryType: "MENTOR_FEE",
            amountMinor: mentorFee,
            orderItemId: item.id,
            projectInstanceId: instance.id,
            memo: `Mentor fee: ${instance.project.title}`,
            idempotencyKey: `mentorfee:${instance.id}`,
          });
          if (item.sellerTenantId) {
            await writeLedgerEntry(tx, {
              account: { ownerType: "TENANT", tenantId: item.sellerTenantId },
              entryType: "MENTOR_FEE",
              amountMinor: -mentorFee,
              orderItemId: item.id,
              projectInstanceId: instance.id,
              memo: `Mentor fee deduction: ${instance.project.title}`,
              idempotencyKey: `mentorfee-seller:${instance.id}`,
            });
          }
        }
      }
    });

    if (parsedInput.decision === "PASS") {
      await issueProjectCredential(instance.id);
      await db.xpEvent.create({
        data: {
          userId: instance.userId,
          kind: "PROJECT_PASSED",
          points: 500,
          refType: "ProjectInstance",
          refId: instance.id,
        },
      });
      // Program rollup: a passed capstone may complete a program.
      const { rollupProjectCompletion } = await import(
        "@/lib/enterprise/program-progress"
      );
      await rollupProjectCompletion(instance.id);
    }
    await db.notification.create({
      data: {
        userId: instance.userId,
        category: "project",
        title:
          parsedInput.decision === "PASS"
            ? "Project passed — mentor-verified 🏆"
            : "Final review: not passed",
        body: parsedInput.summary.slice(0, 200),
        actionUrl: `/learn/projects/${instance.id}`,
      },
    });

    revalidatePath(`/mentor/instances/${instance.id}`);
    return { ok: true };
  });
