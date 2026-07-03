"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  claimSeatForEmail,
  importRosterRows,
  parseRosterCsv,
  revokeSeatCore,
} from "@/lib/enterprise/roster";
import { ActionError, tenantActionClient } from "@/lib/safe-action";
import {
  importRosterSchema,
  seatActionSchema,
  transferSeatSchema,
} from "@/lib/validation/enterprise";

const orgAdminClient = tenantActionClient(["owner", "admin"]);

async function assertLicenseInTenant(licenseId: string, tenantId: string) {
  const license = await db.orgLicense.findUnique({ where: { id: licenseId } });
  if (!license || license.tenantId !== tenantId) throw new ActionError("License not found.");
  return license;
}

async function assertSeatInTenant(seatId: string, tenantId: string) {
  const seat = await db.licenseSeat.findUnique({
    where: { id: seatId },
    include: { license: true },
  });
  if (!seat || seat.license.tenantId !== tenantId) throw new ActionError("Seat not found.");
  return seat;
}

/** Sends the org invitation emails for freshly seated addresses (best-effort). */
async function sendOrgInvitations(organizationId: string, emails: string[]) {
  for (const email of emails) {
    try {
      await auth.api.createInvitation({
        headers: await headers(),
        body: { organizationId, email, role: "member" },
      });
    } catch {
      // Duplicate/pending invitations are fine — the seat match happens by
      // verified email, invitations are only the notification vehicle.
    }
  }
}

export const importRoster = orgAdminClient
  .inputSchema(importRosterSchema)
  .action(async ({ parsedInput, ctx }) => {
    await assertLicenseInTenant(parsedInput.licenseId, ctx.tenant.id);

    const { rows, rejects } = parseRosterCsv(parsedInput.csv);
    if (rows.length === 0) {
      throw new ActionError(
        rejects.length > 0
          ? `No valid rows (first problem: line ${rejects[0].line} — ${rejects[0].reason}).`
          : "The file is empty. Expected: email,name per line.",
      );
    }

    let result;
    try {
      result = await importRosterRows(parsedInput.licenseId, rows);
    } catch (err) {
      throw new ActionError(err instanceof Error ? err.message : "Import failed.");
    }

    await sendOrgInvitations(ctx.tenant.organizationId, result.invited);

    await db.auditLog.create({
      data: {
        actorUserId: ctx.session.user.id,
        actorKind: "USER",
        tenantId: ctx.tenant.id,
        action: "roster.imported",
        entityType: "OrgLicense",
        entityId: parsedInput.licenseId,
        after: {
          invited: result.invited.length,
          alreadySeated: result.alreadySeated.length,
          rejected: result.rejected.length,
          parseRejects: rejects.length,
        },
      },
    });

    revalidatePath(`/org/${ctx.tenant.slug}/roster`);
    return {
      invited: result.invited.length,
      alreadySeated: result.alreadySeated.length,
      rejected: [
        ...rejects.map((r) => ({ email: r.value, reason: r.reason })),
        ...result.rejected,
      ],
    };
  });

export const revokeSeat = orgAdminClient
  .inputSchema(seatActionSchema)
  .action(async ({ parsedInput, ctx }) => {
    await assertSeatInTenant(parsedInput.seatId, ctx.tenant.id);
    await db.$transaction(async (tx) => {
      await revokeSeatCore(tx, parsedInput.seatId);
    });
    revalidatePath(`/org/${ctx.tenant.slug}/roster`);
    return { ok: true };
  });

/** Revoke + invite a replacement under the same license-row lock semantics. */
export const transferSeat = orgAdminClient
  .inputSchema(transferSeatSchema)
  .action(async ({ parsedInput, ctx }) => {
    const seat = await assertSeatInTenant(parsedInput.seatId, ctx.tenant.id);

    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "OrgLicense" WHERE id = ${seat.licenseId} FOR UPDATE`;
      await revokeSeatCore(tx, parsedInput.seatId);
      // Reuses a REVOKED row for the new email; rolls the revoke back if the
      // email already holds a live seat.
      const outcome = await claimSeatForEmail(tx, seat.licenseId, parsedInput.newEmail);
      if (outcome === "already-seated") {
        throw new ActionError("That email already holds a seat on this license.");
      }
    });

    await sendOrgInvitations(ctx.tenant.organizationId, [parsedInput.newEmail]);
    revalidatePath(`/org/${ctx.tenant.slug}/roster`);
    return { ok: true };
  });
