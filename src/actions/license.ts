"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { writeLedgerEntry } from "@/lib/commerce/fulfillment";
import { ActionError, adminActionClient, orgActionClient } from "@/lib/safe-action";
import {
  createLicenseSchema,
  licenseIdInput,
  recordLicensePaymentSchema,
} from "@/lib/validation/enterprise";

const orgAdminClient = orgActionClient(["owner", "admin"]);
const paise = (rupees: number) => BigInt(Math.round(rupees * 100));

/**
 * Creates a license as DRAFT. Activation happens when the platform records
 * the contract payment (sales-led) or via the explicit admin activate action.
 */
export const createLicense = orgAdminClient
  .inputSchema(createLicenseSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (parsedInput.kind === "PROGRAM") {
      const program = await db.program.findUnique({ where: { id: parsedInput.programId } });
      if (!program || program.ownerTenantId !== ctx.tenant.id) {
        throw new ActionError("Program not found in this organization.");
      }
    }

    const license = await db.orgLicense.create({
      data: {
        tenantId: ctx.tenant.id,
        kind: parsedInput.kind,
        programId: parsedInput.kind === "PROGRAM" ? parsedInput.programId : null,
        seats: parsedInput.kind === "CREDIT_POOL" ? 0 : parsedInput.seats,
        startsAt: parsedInput.startsAt,
        endsAt: parsedInput.endsAt,
        contractRef: parsedInput.contractRef,
        contractValueMinor:
          parsedInput.contractValueRupees != null
            ? paise(parsedInput.contractValueRupees)
            : null,
        catalogScope:
          parsedInput.kind === "CATALOG" && parsedInput.catalogCourseIds.length > 0
            ? { courseIds: parsedInput.catalogCourseIds }
            : undefined,
        notes: parsedInput.notes,
      },
    });

    await db.auditLog.create({
      data: {
        actorUserId: ctx.session.user.id,
        actorKind: "USER",
        tenantId: ctx.tenant.id,
        action: "license.created",
        entityType: "OrgLicense",
        entityId: license.id,
        after: { kind: license.kind, seats: license.seats },
      },
    });

    revalidatePath(`/org/${ctx.tenant.slug}/licenses`);
    return { licenseId: license.id };
  });

export const cancelLicense = orgAdminClient
  .inputSchema(licenseIdInput)
  .action(async ({ parsedInput, ctx }) => {
    const license = await db.orgLicense.findUnique({ where: { id: parsedInput.licenseId } });
    if (!license || license.tenantId !== ctx.tenant.id) {
      throw new ActionError("License not found.");
    }
    await db.$transaction([
      db.orgLicense.update({
        where: { id: license.id },
        data: { status: "CANCELLED" },
      }),
      db.enrollment.updateMany({
        where: { orgLicenseId: license.id, status: "ACTIVE" },
        data: { status: "EXPIRED", expiresAt: new Date() },
      }),
    ]);
    revalidatePath(`/org/${ctx.tenant.slug}/licenses`);
    return { ok: true };
  });

/** Platform admin: record the contract payment — activates a DRAFT license. */
export const recordLicensePayment = adminActionClient
  .inputSchema(recordLicensePaymentSchema)
  .action(async ({ parsedInput, ctx }) => {
    const license = await db.orgLicense.findUnique({
      where: { id: parsedInput.licenseId },
      include: { tenant: true },
    });
    if (!license) throw new ActionError("License not found.");

    const amountMinor = paise(parsedInput.amountRupees);
    const ref =
      parsedInput.reference ??
      `manual-${license.tenant.slug}-${license.id.slice(-6)}-${Date.now()}`;

    await db.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          orgLicenseId: license.id,
          provider: "MANUAL",
          providerPaymentRef: ref,
          amountMinor,
          currency: license.currency ?? "INR",
          status: "CAPTURED",
          capturedAt: new Date(),
        },
      });
      // Contract revenue lands on the platform ledger for reporting parity.
      await writeLedgerEntry(tx, {
        account: { ownerType: "PLATFORM" },
        entryType: "ADJUSTMENT",
        amountMinor,
        currency: license.currency ?? "INR",
        memo: `Enterprise contract: ${license.tenant.displayName} (${license.kind})`,
        idempotencyKey: `license-payment:${payment.id}`,
      });
      if (license.status === "DRAFT") {
        await tx.orgLicense.update({
          where: { id: license.id },
          data: { status: "ACTIVE" },
        });
      }
    });

    await db.auditLog.create({
      data: {
        actorUserId: ctx.session.user.id,
        actorKind: "ADMIN",
        tenantId: license.tenantId,
        action: "license.payment.recorded",
        entityType: "OrgLicense",
        entityId: license.id,
        after: { amountMinor: amountMinor.toString(), reference: ref },
      },
    });

    revalidatePath("/admin/licenses");
    return { ok: true };
  });

/** Platform admin: activate without payment (e.g. pilot/POC). */
export const activateLicense = adminActionClient
  .inputSchema(z.object({ licenseId: z.string().min(1) }))
  .action(async ({ parsedInput }) => {
    await db.orgLicense.update({
      where: { id: parsedInput.licenseId },
      data: { status: "ACTIVE" },
    });
    revalidatePath("/admin/licenses");
    return { ok: true };
  });
