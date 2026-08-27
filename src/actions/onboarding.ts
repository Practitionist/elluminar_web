"use server";

import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";

import { db } from "@/lib/db";
import { ActionError, authActionClient } from "@/lib/safe-action";
import { slugify } from "@/lib/slug";
import {
  completeOnboardingSchema,
  onboardingCommsSchema,
  onboardingGoalsSchema,
  onboardingProfileSchema,
  type OnboardingStep,
} from "@/lib/validation/onboarding";

/**
 * Learner onboarding. Every step persists on submit, so progress survives a
 * refresh or a switch of device — there is no draft row and no client state to
 * lose. Progress itself rides in PortfolioProfile.about (an existing Json
 * column), which keeps the Prisma schema frozen.
 */

type StoredAbout = Record<string, unknown> & { onboardingSteps?: string[] };

/**
 * PortfolioProfile.slug is unique and required, so the row cannot be created
 * lazily at the end. The suffix keeps two people named "Ada Lovelace" from
 * colliding; the user can change the handle later from their portfolio.
 */
async function ensurePortfolioProfile(userId: string, name: string) {
  const existing = await db.portfolioProfile.findUnique({
    where: { userId },
    select: { about: true },
  });
  if (existing) return (existing.about ?? {}) as StoredAbout;

  const base = slugify(name) || "learner";
  await db.portfolioProfile.create({
    data: {
      userId,
      slug: `${base}-${nanoid(6).toLowerCase()}`,
      visibility: "PRIVATE",
      about: {},
    },
  });
  return {} as StoredAbout;
}

async function markStepComplete(
  userId: string,
  step: OnboardingStep,
  patch: Record<string, unknown>,
  name: string,
) {
  const about = await ensurePortfolioProfile(userId, name);
  const steps = new Set([...(about.onboardingSteps ?? []), step]);

  await db.portfolioProfile.update({
    where: { userId },
    data: {
      about: { ...about, ...patch, onboardingSteps: [...steps] },
    },
  });
}

export const saveOnboardingProfile = authActionClient
  .inputSchema(onboardingProfileSchema)
  .action(async ({ parsedInput, ctx }) => {
    await db.user.update({
      where: { id: ctx.session.user.id },
      data: {
        name: parsedInput.name,
        phone: parsedInput.phone ? parsedInput.phone : null,
        timezone: parsedInput.timezone,
        locale: parsedInput.locale,
      },
    });

    await markStepComplete(ctx.session.user.id, "profile", {}, parsedInput.name);

    revalidatePath("/welcome");
    return { ok: true };
  });

export const saveOnboardingGoals = authActionClient
  .inputSchema(onboardingGoalsSchema)
  .action(async ({ parsedInput, ctx }) => {
    // Interest slugs come from the client, so re-check them against the
    // catalog rather than storing whatever was posted.
    const known = await db.category.findMany({
      where: { slug: { in: parsedInput.interests } },
      select: { slug: true },
    });
    if (known.length === 0) {
      throw new ActionError("Pick at least one area we actually teach.");
    }

    await markStepComplete(
      ctx.session.user.id,
      "goals",
      {
        goal: parsedInput.goal,
        experienceLevel: parsedInput.experienceLevel,
        interests: known.map((c) => c.slug),
        capturedAt: new Date().toISOString(),
      },
      ctx.session.user.name,
    );

    if (parsedInput.headline) {
      await db.portfolioProfile.update({
        where: { userId: ctx.session.user.id },
        data: { headline: parsedInput.headline },
      });
    }

    revalidatePath("/welcome");
    return { ok: true };
  });

export const saveOnboardingComms = authActionClient
  .inputSchema(onboardingCommsSchema)
  .action(async ({ parsedInput, ctx }) => {
    const prefs = {
      product: parsedInput.productEmails,
      mentorFeedback: parsedInput.mentorFeedbackEmails,
      cohortReminders: parsedInput.cohortRemindersEmails,
    };

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

    await markStepComplete(
      ctx.session.user.id,
      "comms",
      {},
      ctx.session.user.name,
    );

    revalidatePath("/welcome");
    return { ok: true };
  });

/**
 * Stamps User.onboardedAt — the column that has existed since the initial
 * migration and, until now, was never written by anything but the seed script.
 *
 * Skipping stamps it too. A user who declines once should not be asked again
 * on every visit; the same questions are all available under /account.
 */
export const completeOnboarding = authActionClient
  .inputSchema(completeOnboardingSchema)
  .action(async ({ parsedInput, ctx }) => {
    await db.user.update({
      where: { id: ctx.session.user.id },
      data: { onboardedAt: new Date() },
    });

    await db.auditLog.create({
      data: {
        actorUserId: ctx.session.user.id,
        actorKind: "USER",
        action: parsedInput.skipped ? "onboarding.skipped" : "onboarding.completed",
        entityType: "User",
        entityId: ctx.session.user.id,
      },
    });

    revalidatePath("/welcome");
    revalidatePath("/learn");
    return { ok: true };
  });
