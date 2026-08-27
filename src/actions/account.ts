"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ActionError, authActionClient } from "@/lib/safe-action";
import { changeEmailSchema } from "@/lib/validation/auth";
import {
  onboardingCommsSchema,
  onboardingProfileSchema,
} from "@/lib/validation/onboarding";

/**
 * Account mutations. Credential operations that need the caller's password or
 * that set cookies (change password, 2FA enrolment, session revocation) stay on
 * `authClient` in the browser — BetterAuth already exposes them, already
 * re-authorizes them, and routing them through an action would only re-derive
 * its error codes by hand.
 *
 * What lives here is everything that writes OUR columns.
 */

/** Reuses the onboarding profile schema — same fields, same rules, one definition. */
export const updateAccountProfile = authActionClient
  .inputSchema(onboardingProfileSchema)
  .action(async ({ parsedInput, ctx }) => {
    const before = await db.user.findUniqueOrThrow({
      where: { id: ctx.session.user.id },
      select: { name: true, phone: true, timezone: true, locale: true },
    });

    await db.user.update({
      where: { id: ctx.session.user.id },
      data: {
        name: parsedInput.name,
        // An empty string means "clear it", which is not the same as "leave it".
        phone: parsedInput.phone ? parsedInput.phone : null,
        timezone: parsedInput.timezone,
        locale: parsedInput.locale,
      },
    });

    await db.auditLog.create({
      data: {
        actorUserId: ctx.session.user.id,
        actorKind: "USER",
        action: "account.profile.updated",
        entityType: "User",
        entityId: ctx.session.user.id,
        before,
        after: {
          name: parsedInput.name,
          phone: parsedInput.phone || null,
          timezone: parsedInput.timezone,
          locale: parsedInput.locale,
        },
      },
    });

    revalidatePath("/account");
    return { ok: true };
  });

export const updateNotificationPreferences = authActionClient
  .inputSchema(onboardingCommsSchema)
  .action(async ({ parsedInput, ctx }) => {
    const prefs = {
      product: parsedInput.productEmails,
      mentorFeedback: parsedInput.mentorFeedbackEmails,
      cohortReminders: parsedInput.cohortRemindersEmails,
    };

    // Two writes, one transaction: marketingOptIn is a DPDP consent record and
    // must not end up disagreeing with the preference matrix beside it.
    await db.$transaction([
      db.user.update({
        where: { id: ctx.session.user.id },
        data: { marketingOptIn: parsedInput.marketingOptIn },
      }),
      db.notificationPreference.upsert({
        where: { userId: ctx.session.user.id },
        create: { userId: ctx.session.user.id, prefs },
        update: { prefs },
      }),
    ]);

    revalidatePath("/account/notifications");
    return { ok: true };
  });

/**
 * Starts an email change. BetterAuth sends the confirmation to the CURRENT
 * address and does not apply the change until that link is followed, so an
 * attacker holding a live session cannot silently move the account.
 */
export const requestEmailChange = authActionClient
  .inputSchema(changeEmailSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (parsedInput.newEmail.toLowerCase() === ctx.session.user.email.toLowerCase()) {
      throw new ActionError("That's already your email address.");
    }

    const taken = await db.user.findUnique({
      where: { email: parsedInput.newEmail },
      select: { id: true },
    });
    if (taken) throw new ActionError("That email is already in use.");

    await auth.api
      .changeEmail({
        headers: await headers(),
        body: { newEmail: parsedInput.newEmail, callbackURL: "/account/security" },
      })
      .catch((err: unknown) => {
        throw new ActionError(
          err instanceof Error ? err.message : "Could not start the email change.",
        );
      });

    await db.auditLog.create({
      data: {
        actorUserId: ctx.session.user.id,
        actorKind: "USER",
        action: "account.email.change_requested",
        entityType: "User",
        entityId: ctx.session.user.id,
        after: { newEmail: parsedInput.newEmail },
      },
    });

    revalidatePath("/account/security");
    return { ok: true, sentTo: ctx.session.user.email };
  });

/**
 * Audit trail for security events the browser performs directly against
 * BetterAuth. Without this, enabling or disabling 2FA — the single most
 * security-relevant thing a user can do to their own account — would leave no
 * record anywhere.
 */
export const recordSecurityEvent = authActionClient
  .inputSchema(
    z.object({
      event: z.enum([
        "two_factor.enabled",
        "two_factor.disabled",
        "two_factor.backup_codes_regenerated",
        "password.changed",
        "sessions.revoked_others",
      ]),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    await db.auditLog.create({
      data: {
        actorUserId: ctx.session.user.id,
        actorKind: "USER",
        action: `account.${parsedInput.event}`,
        entityType: "User",
        entityId: ctx.session.user.id,
      },
    });

    revalidatePath("/account/security");
    revalidatePath("/account/sessions");
    return { ok: true };
  });
