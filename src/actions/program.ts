"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { validateUnlockEdge } from "@/lib/enterprise/unlock";
import { plainTextToTiptap } from "@/lib/richtext";
import { ActionError, tenantActionClient } from "@/lib/safe-action";
import {
  bulkEnrollSchema,
  programItemSchema,
  setUnlockRuleSchema,
  upsertProgramCohortSchema,
  upsertProgramSchema,
} from "@/lib/validation/enterprise";
import { slugSchema } from "@/lib/validation/tenant";

const orgAdminClient = tenantActionClient(["owner", "admin"]);

async function assertProgramInTenant(programId: string, tenantId: string) {
  const program = await db.program.findUnique({ where: { id: programId } });
  if (!program || program.ownerTenantId !== tenantId) {
    throw new ActionError("Program not found.");
  }
  return program;
}

export const upsertProgram = orgAdminClient
  .inputSchema(upsertProgramSchema)
  .action(async ({ parsedInput, ctx }) => {
    // undefined = leave the program's template untouched on update (the edit
    // form doesn't send it); null = explicit clear; string = set.
    let templateId = parsedInput.certificateTemplateId;
    // Convenience: naming a co-brand partner creates/updates a PROGRAM template.
    if (parsedInput.coBrandPartnerName) {
      const existing = templateId
        ? await db.certificateTemplate.findUnique({ where: { id: templateId } })
        : await db.certificateTemplate.findFirst({
            where: { tenantId: ctx.tenant.id, kind: "PROGRAM" },
          });
      const template = existing
        ? await db.certificateTemplate.update({
            where: { id: existing.id },
            data: { coBrand: { partnerName: parsedInput.coBrandPartnerName } },
          })
        : await db.certificateTemplate.create({
            data: {
              tenantId: ctx.tenant.id,
              kind: "PROGRAM",
              name: `${ctx.tenant.displayName} co-branded`,
              design: { layout: "landscape-a4", heading: "Program Certificate" },
              coBrand: { partnerName: parsedInput.coBrandPartnerName },
            },
          });
      templateId = template.id;
    }

    let programId = parsedInput.programId;
    if (programId) {
      await assertProgramInTenant(programId, ctx.tenant.id);
      await db.program.update({
        where: { id: programId },
        data: {
          title: parsedInput.title,
          slug: parsedInput.slug,
          description: parsedInput.description
            ? plainTextToTiptap(parsedInput.description)
            : undefined,
          certificateTemplateId: templateId,
        },
      });
    } else {
      const dup = await db.program.findUnique({
        where: {
          ownerTenantId_slug: { ownerTenantId: ctx.tenant.id, slug: parsedInput.slug },
        },
      });
      if (dup) throw new ActionError("A program with that slug already exists.");
      const program = await db.program.create({
        data: {
          ownerTenantId: ctx.tenant.id,
          createdById: ctx.session.user.id,
          title: parsedInput.title,
          slug: parsedInput.slug,
          description: parsedInput.description
            ? plainTextToTiptap(parsedInput.description)
            : undefined,
          certificateTemplateId: templateId,
        },
      });
      programId = program.id;
    }
    revalidatePath(`/org/${ctx.tenant.slug}/programs`);
    return { programId };
  });

export const setProgramStatus = orgAdminClient
  .inputSchema(
    z.object({
      tenantSlug: slugSchema,
      programId: z.string().min(1),
      status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const program = await assertProgramInTenant(parsedInput.programId, ctx.tenant.id);
    if (parsedInput.status === "ACTIVE") {
      const items = await db.programItem.count({ where: { programId: program.id } });
      if (items === 0) throw new ActionError("Add at least one item before activating.");
    }
    await db.program.update({
      where: { id: program.id },
      data: { status: parsedInput.status },
    });
    revalidatePath(`/org/${ctx.tenant.slug}/programs/${program.id}`);
    return { ok: true };
  });

export const addProgramItem = orgAdminClient
  .inputSchema(programItemSchema)
  .action(async ({ parsedInput, ctx }) => {
    await assertProgramInTenant(parsedInput.programId, ctx.tenant.id);

    if (parsedInput.itemType === "COURSE") {
      const course = parsedInput.courseId
        ? await db.course.findUnique({ where: { id: parsedInput.courseId } })
        : null;
      if (!course || course.status !== "PUBLISHED") {
        throw new ActionError("Pick a published course.");
      }
    } else {
      const project = parsedInput.projectId
        ? await db.project.findUnique({ where: { id: parsedInput.projectId } })
        : null;
      if (!project || project.status !== "PUBLISHED") {
        throw new ActionError("Pick a published project.");
      }
    }

    const last = await db.programItem.findFirst({
      where: { programId: parsedInput.programId },
      orderBy: { position: "desc" },
    });
    await db.programItem.create({
      data: {
        programId: parsedInput.programId,
        position: (last?.position ?? -1) + 1,
        itemType: parsedInput.itemType,
        courseId: parsedInput.itemType === "COURSE" ? parsedInput.courseId : null,
        projectId: parsedInput.itemType === "PROJECT" ? parsedInput.projectId : null,
        required: parsedInput.required,
      },
    });
    revalidatePath(`/org/${ctx.tenant.slug}/programs/${parsedInput.programId}`);
    return { ok: true };
  });

export const removeProgramItem = orgAdminClient
  .inputSchema(
    z.object({
      tenantSlug: slugSchema,
      programId: z.string().min(1),
      itemId: z.string().min(1),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    await assertProgramInTenant(parsedInput.programId, ctx.tenant.id);
    await db.$transaction([
      // Clear unlock rules pointing at the removed item (never brick).
      db.programItem.updateMany({
        where: { programId: parsedInput.programId, unlockAfterItemId: parsedInput.itemId },
        data: { unlockAfterItemId: null },
      }),
      // Scoped to the asserted program — a bare id would delete across programs.
      db.programItem.deleteMany({
        where: { id: parsedInput.itemId, programId: parsedInput.programId },
      }),
    ]);
    revalidatePath(`/org/${ctx.tenant.slug}/programs/${parsedInput.programId}`);
    return { ok: true };
  });

export const setUnlockRule = orgAdminClient
  .inputSchema(setUnlockRuleSchema)
  .action(async ({ parsedInput, ctx }) => {
    await assertProgramInTenant(parsedInput.programId, ctx.tenant.id);
    const items = await db.programItem.findMany({
      where: { programId: parsedInput.programId },
      select: { id: true, unlockAfterItemId: true, position: true },
    });
    const error = validateUnlockEdge(items, parsedInput.itemId, parsedInput.unlockAfterItemId);
    if (error) throw new ActionError(error);
    await db.programItem.update({
      where: { id: parsedInput.itemId },
      data: { unlockAfterItemId: parsedInput.unlockAfterItemId },
    });
    revalidatePath(`/org/${ctx.tenant.slug}/programs/${parsedInput.programId}`);
    return { ok: true };
  });

/** Bulk-enrolls activated seats into a program cohort (idempotent fan-out). */
export const bulkEnrollSeats = orgAdminClient
  .inputSchema(bulkEnrollSchema)
  .action(async ({ parsedInput, ctx }) => {
    const cohort = await db.programCohort.findUnique({
      where: { id: parsedInput.programCohortId },
      include: { program: true, _count: { select: { enrollments: true } } },
    });
    if (!cohort || cohort.program.ownerTenantId !== ctx.tenant.id) {
      throw new ActionError("Cohort not found.");
    }
    if (
      cohort.capacity != null &&
      cohort._count.enrollments + parsedInput.seatIds.length > cohort.capacity
    ) {
      throw new ActionError(
        `Capacity exceeded: ${cohort._count.enrollments} enrolled, ${cohort.capacity} capacity.`,
      );
    }

    const seats = await db.licenseSeat.findMany({
      where: {
        id: { in: parsedInput.seatIds },
        status: "ACTIVATED",
        license: { tenantId: ctx.tenant.id },
      },
    });
    if (seats.length === 0) throw new ActionError("No activated seats selected.");

    const { enrollUserInProgramCohort } = await import("@/lib/enterprise/fanout");
    let enrolled = 0;
    for (const seat of seats) {
      if (!seat.userId) continue;
      await enrollUserInProgramCohort({
        programCohortId: cohort.id,
        userId: seat.userId,
        licenseSeatId: seat.id,
      });
      enrolled += 1;
    }

    await db.auditLog.create({
      data: {
        actorUserId: ctx.session.user.id,
        actorKind: "USER",
        tenantId: ctx.tenant.id,
        action: "program.cohort.bulk_enrolled",
        entityType: "ProgramCohort",
        entityId: cohort.id,
        after: { enrolled },
      },
    });

    revalidatePath(`/org/${ctx.tenant.slug}/programs/${cohort.programId}`);
    return { enrolled };
  });

export const upsertProgramCohort = orgAdminClient
  .inputSchema(upsertProgramCohortSchema)
  .action(async ({ parsedInput, ctx }) => {
    await assertProgramInTenant(parsedInput.programId, ctx.tenant.id);
    const data = {
      name: parsedInput.name,
      startsAt: parsedInput.startsAt ?? null,
      endsAt: parsedInput.endsAt ?? null,
      capacity: parsedInput.capacity ?? null,
    };
    if (parsedInput.cohortId) {
      // Scoped to the asserted program — a bare id would update across programs.
      const updated = await db.programCohort.updateMany({
        where: { id: parsedInput.cohortId, programId: parsedInput.programId },
        data,
      });
      if (updated.count === 0) throw new ActionError("Cohort not found.");
    } else {
      await db.programCohort.create({
        data: { ...data, programId: parsedInput.programId, status: "OPEN" },
      });
    }
    revalidatePath(`/org/${ctx.tenant.slug}/programs/${parsedInput.programId}`);
    return { ok: true };
  });
