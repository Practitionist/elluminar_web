"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { plainTextToTiptap } from "@/lib/richtext";
import { ActionError, adminActionClient, studioActionClient } from "@/lib/safe-action";
import { slugSchema } from "@/lib/validation/tenant";

const editorClient = studioActionClient(["owner", "admin", "instructor"]);
const paise = (rupees: number) => BigInt(Math.round(rupees * 100));

async function assertProjectInTenant(projectId: string, tenantId: string) {
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project || project.tenantId !== tenantId) throw new ActionError("Project not found.");
  return project;
}

export const createProject = editorClient
  .inputSchema(
    z.object({
      tenantSlug: slugSchema,
      title: z.string().min(3).max(140),
      slug: slugSchema,
      tier: z.enum(["SPRINT", "CAPSTONE", "FLAGSHIP"]).default("CAPSTONE"),
      summary: z.string().min(20).max(500),
      brief: z.string().min(50).max(20000),
      techStack: z.array(z.string().min(1).max(30)).max(12).default([]),
      durationWeeksMin: z.number().int().min(1).max(52),
      durationWeeksMax: z.number().int().min(1).max(52),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    if (parsedInput.durationWeeksMax < parsedInput.durationWeeksMin) {
      throw new ActionError("Max duration must be ≥ min duration.");
    }
    const dup = await db.project.findUnique({
      where: { tenantId_slug: { tenantId: ctx.tenant.id, slug: parsedInput.slug } },
    });
    if (dup) throw new ActionError("A project with that slug already exists.");

    const rubric = await db.rubric.create({
      data: {
        tenantId: ctx.tenant.id,
        name: `${parsedInput.title} rubric`,
        criteria: {
          create: [
            { name: "Correctness", description: "Works against the held-out evaluation", weightPct: 40, levels: {}, position: 0 },
            { name: "Code quality", description: "Structure, tests, readability", weightPct: 30, levels: {}, position: 1 },
            { name: "Design judgment", description: "Tradeoffs made and justified", weightPct: 30, levels: {}, position: 2 },
          ],
        },
      },
    });

    const project = await db.project.create({
      data: {
        tenantId: ctx.tenant.id,
        createdById: ctx.session.user.id,
        title: parsedInput.title,
        slug: parsedInput.slug,
        tier: parsedInput.tier,
        summary: parsedInput.summary,
        brief: plainTextToTiptap(parsedInput.brief),
        techStack: parsedInput.techStack,
        durationWeeksMin: parsedInput.durationWeeksMin,
        durationWeeksMax: parsedInput.durationWeeksMax,
        mentorHoursBudget: parsedInput.tier === "FLAGSHIP" ? 15 : parsedInput.tier === "CAPSTONE" ? 4 : 1,
        defenseRequired: parsedInput.tier !== "SPRINT",
        rubricId: rubric.id,
        milestones: {
          create: [
            { title: "Design & plan", description: plainTextToTiptap("Architecture doc + scoped plan"), position: 0, expectedWeek: 1, deliverables: { items: ["design doc"] }, isReviewCheckpoint: true, weightPct: 20 },
            { title: "Working core", description: plainTextToTiptap("Core functionality demonstrably working"), position: 1, expectedWeek: 3, deliverables: { items: ["repo", "demo"] }, isReviewCheckpoint: true, weightPct: 40 },
            { title: "Hardening & final", description: plainTextToTiptap("Edge cases, tests, final delivery"), position: 2, expectedWeek: 5, deliverables: { items: ["final repo", "writeup"] }, isReviewCheckpoint: true, weightPct: 40 },
          ],
        },
      },
    });

    revalidatePath(`/studio/${ctx.tenant.slug}/projects`);
    return { projectId: project.id };
  });

export const updateProjectBasics = editorClient
  .inputSchema(
    z.object({
      tenantSlug: slugSchema,
      projectId: z.string().min(1),
      title: z.string().min(3).max(140),
      summary: z.string().min(20).max(500),
      brief: z.string().min(50).max(20000),
      techStack: z.array(z.string().min(1).max(30)).max(12),
      visibility: z.enum(["MARKETPLACE", "TENANT_ONLY", "PRIVATE"]),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    await assertProjectInTenant(parsedInput.projectId, ctx.tenant.id);
    await db.project.update({
      where: { id: parsedInput.projectId },
      data: {
        title: parsedInput.title,
        summary: parsedInput.summary,
        brief: plainTextToTiptap(parsedInput.brief),
        techStack: parsedInput.techStack,
        visibility: parsedInput.visibility,
      },
    });
    revalidatePath(`/studio/${ctx.tenant.slug}/projects/${parsedInput.projectId}`);
    return { ok: true };
  });

export const setProjectPrice = editorClient
  .inputSchema(
    z.object({
      tenantSlug: slugSchema,
      projectId: z.string().min(1),
      amountRupees: z.number().min(0).max(2_000_000),
      mentorLevel: z.enum(["ASSOCIATE", "SENIOR", "PRINCIPAL"]).optional(),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    await assertProjectInTenant(parsedInput.projectId, ctx.tenant.id);
    const existing = await db.price.findFirst({
      where: {
        projectId: parsedInput.projectId,
        currency: "INR",
        region: null,
        mentorLevel: parsedInput.mentorLevel ?? null,
      },
    });
    if (existing) {
      await db.price.update({
        where: { id: existing.id },
        data: { amountMinor: paise(parsedInput.amountRupees), active: true },
      });
    } else {
      await db.price.create({
        data: {
          itemType: "PROJECT",
          projectId: parsedInput.projectId,
          currency: "INR",
          mentorLevel: parsedInput.mentorLevel ?? null,
          amountMinor: paise(parsedInput.amountRupees),
        },
      });
    }
    revalidatePath(`/studio/${ctx.tenant.slug}/projects/${parsedInput.projectId}`);
    return { ok: true };
  });

export const submitProjectForReview = editorClient
  .inputSchema(z.object({ tenantSlug: slugSchema, projectId: z.string().min(1) }))
  .action(async ({ parsedInput, ctx }) => {
    const project = await assertProjectInTenant(parsedInput.projectId, ctx.tenant.id);
    if (ctx.tenant.status !== "APPROVED") {
      throw new ActionError("Your school must be approved before publishing.");
    }
    const [milestones, price] = await Promise.all([
      db.milestone.count({ where: { projectId: project.id } }),
      db.price.findFirst({ where: { projectId: project.id, active: true } }),
    ]);
    if (milestones === 0) throw new ActionError("Add at least one milestone.");
    if (!price) throw new ActionError("Set a price first.");
    await db.project.update({ where: { id: project.id }, data: { status: "IN_REVIEW" } });
    revalidatePath(`/studio/${ctx.tenant.slug}/projects/${project.id}`);
    return { ok: true };
  });

export const reviewProject = adminActionClient
  .inputSchema(
    z.object({
      projectId: z.string().min(1),
      decision: z.enum(["PUBLISHED", "DRAFT"]),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const project = await db.project.findUnique({ where: { id: parsedInput.projectId } });
    if (!project) throw new ActionError("Project not found.");
    await db.project.update({
      where: { id: project.id },
      data: {
        status: parsedInput.decision,
        publishedAt: parsedInput.decision === "PUBLISHED" ? new Date() : project.publishedAt,
      },
    });
    await db.auditLog.create({
      data: {
        actorUserId: ctx.session.user.id,
        actorKind: "ADMIN",
        tenantId: project.tenantId,
        action: `project.review.${parsedInput.decision.toLowerCase()}`,
        entityType: "Project",
        entityId: project.id,
      },
    });
    revalidatePath("/admin/moderation");
    return { ok: true };
  });
