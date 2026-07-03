"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { plainTextToTiptap } from "@/lib/richtext";
import { ActionError, adminActionClient, authActionClient } from "@/lib/safe-action";
import {
  adminCreateEnterpriseTenantSchema,
  applyAsOrganizationSchema,
} from "@/lib/validation/enterprise";

/**
 * Sales-led motion: platform admin creates an enterprise/university tenant
 * (pre-APPROVED — the contract already exists) and invites the primary org
 * admin as owner. The platform admin remains a member for CS access.
 */
export const adminCreateEnterpriseTenant = adminActionClient
  .inputSchema(adminCreateEnterpriseTenantSchema)
  .action(async ({ parsedInput, ctx }) => {
    const dup = await db.tenant.findUnique({ where: { slug: parsedInput.slug } });
    if (dup) throw new ActionError("That slug is already taken.");

    const org = await auth.api.createOrganization({
      headers: await headers(),
      body: { name: parsedInput.name, slug: parsedInput.slug },
    });
    if (!org) throw new ActionError("Could not create the organization.");

    const tenant = await db.tenant.update({
      where: { organizationId: org.id },
      data: {
        type: parsedInput.type,
        status: "APPROVED",
        displayName: parsedInput.name,
        about: parsedInput.about ? plainTextToTiptap(parsedInput.about) : undefined,
        approvedById: ctx.session.user.id,
        approvedAt: new Date(),
      },
    });

    await auth.api.createInvitation({
      headers: await headers(),
      body: {
        organizationId: org.id,
        email: parsedInput.primaryAdminEmail,
        role: "owner",
      },
    });

    await db.auditLog.create({
      data: {
        actorUserId: ctx.session.user.id,
        actorKind: "ADMIN",
        tenantId: tenant.id,
        action: "tenant.enterprise.created",
        entityType: "Tenant",
        entityId: tenant.id,
        after: { type: parsedInput.type, primaryAdminEmail: parsedInput.primaryAdminEmail },
      },
    });

    revalidatePath("/admin/tenants");
    return { tenantSlug: tenant.slug };
  });

/**
 * Self-serve motion: typed application (Creator / Company / University).
 * The afterCreateOrganization hook provisions Tenant(CREATOR, APPLIED) in the
 * same request; we then set the chosen type. Admin approval unlocks the portal.
 */
export const applyAsOrganization = authActionClient
  .inputSchema(applyAsOrganizationSchema)
  .action(async ({ parsedInput, ctx }) => {
    const existing = await db.tenant.findUnique({ where: { slug: parsedInput.slug } });
    if (existing) throw new ActionError("That handle is already taken.");

    const org = await auth.api.createOrganization({
      headers: await headers(),
      body: { name: parsedInput.name, slug: parsedInput.slug },
    });
    if (!org) throw new ActionError("Could not create your organization.");

    const tenant = await db.tenant.update({
      where: { organizationId: org.id },
      data: {
        type: parsedInput.type,
        displayName: parsedInput.name,
        about: parsedInput.about ? plainTextToTiptap(parsedInput.about) : undefined,
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
        after: { type: parsedInput.type },
      },
    });

    revalidatePath("/studio");
    return { tenantSlug: tenant.slug, type: parsedInput.type };
  });
