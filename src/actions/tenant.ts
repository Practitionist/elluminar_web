"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  ActionError,
  adminActionClient,
  authActionClient,
  studioActionClient,
} from "@/lib/safe-action";
import {
  createCreatorApplicationSchema,
  reviewTenantSchema,
  updateTenantSettingsSchema,
} from "@/lib/validation/tenant";

/**
 * Creator application: creates the BetterAuth organization (which provisions a
 * Tenant via the afterCreateOrganization hook), then fills in profile fields.
 */
export const applyAsCreator = authActionClient
  .inputSchema(createCreatorApplicationSchema)
  .action(async ({ parsedInput, ctx }) => {
    const existing = await db.tenant.findUnique({ where: { slug: parsedInput.slug } });
    if (existing) throw new ActionError("That handle is already taken.");

    const org = await auth.api.createOrganization({
      headers: await headers(),
      body: {
        name: parsedInput.name,
        slug: parsedInput.slug,
      },
    });
    if (!org) throw new ActionError("Could not create your school.");

    const tenant = await db.tenant.update({
      where: { organizationId: org.id },
      data: {
        displayName: parsedInput.name,
        about: parsedInput.about
          ? { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: parsedInput.about }] }] }
          : undefined,
        supportEmail: parsedInput.supportEmail || null,
      },
    });

    await db.auditLog.create({
      data: {
        actorUserId: ctx.session.user.id,
        actorKind: "USER",
        tenantId: tenant.id,
        action: "tenant.applied",
        entityType: "Tenant",
        entityId: tenant.id,
      },
    });

    revalidatePath("/studio");
    return { tenantSlug: tenant.slug };
  });

export const updateTenantSettings = studioActionClient(["owner", "admin"])
  .inputSchema(updateTenantSettingsSchema)
  .action(async ({ parsedInput, ctx }) => {
    await db.tenant.update({
      where: { id: ctx.tenant.id },
      data: {
        displayName: parsedInput.displayName,
        about: parsedInput.about
          ? { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: parsedInput.about }] }] }
          : undefined,
        supportEmail: parsedInput.supportEmail || null,
        socials: parsedInput.socials ?? undefined,
      },
    });
    revalidatePath(`/studio/${ctx.tenant.slug}`);
    revalidatePath(`/c/${ctx.tenant.slug}`);
    return { ok: true };
  });

/** Platform admin: approve or suspend a tenant application. */
export const reviewTenant = adminActionClient
  .inputSchema(reviewTenantSchema)
  .action(async ({ parsedInput, ctx }) => {
    const tenant = await db.tenant.findUnique({ where: { id: parsedInput.tenantId } });
    if (!tenant) throw new ActionError("Tenant not found.");

    await db.tenant.update({
      where: { id: tenant.id },
      data: {
        status: parsedInput.decision,
        approvedById: parsedInput.decision === "APPROVED" ? ctx.session.user.id : null,
        approvedAt: parsedInput.decision === "APPROVED" ? new Date() : null,
      },
    });

    await db.auditLog.create({
      data: {
        actorUserId: ctx.session.user.id,
        actorKind: "ADMIN",
        tenantId: tenant.id,
        action: `tenant.${parsedInput.decision.toLowerCase()}`,
        entityType: "Tenant",
        entityId: tenant.id,
        before: { status: tenant.status },
        after: { status: parsedInput.decision },
      },
    });

    revalidatePath("/admin/tenants");
    revalidatePath(`/studio/${tenant.slug}`);
    return { ok: true };
  });
