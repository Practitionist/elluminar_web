"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { nanoid } from "nanoid";
import { z } from "zod";

import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ActionError, actionClient } from "@/lib/safe-action";

const ANON_CART_COOKIE = "lms_cart";

/** Moves anonymous-cart items into the user's cart (DB writes only — RSC-safe). */
async function mergeAnonCart(anonId: string, userCart: { id: string; items: { id: string; courseId: string | null; cohortId: string | null; projectId: string | null; planId: string | null; bundleId: string | null; digitalProductId: string | null; mentorOfferingId: string | null; aiCreditPackId: string | null }[] }) {
  const anonCart = await db.cart.findFirst({
    where: { anonymousId: anonId, status: "ACTIVE", userId: null },
    include: { items: true },
  });
  if (!anonCart || anonCart.id === userCart.id) return;
  for (const item of anonCart.items) {
    const dup = userCart.items.some(
      (i) =>
        i.courseId === item.courseId &&
        i.cohortId === item.cohortId &&
        i.projectId === item.projectId &&
        i.planId === item.planId &&
        i.bundleId === item.bundleId &&
        i.digitalProductId === item.digitalProductId &&
        i.mentorOfferingId === item.mentorOfferingId &&
        i.aiCreditPackId === item.aiCreditPackId,
    );
    if (!dup) {
      await db.cartItem.update({ where: { id: item.id }, data: { cartId: userCart.id } });
    }
  }
  await db.cart.update({ where: { id: anonCart.id }, data: { status: "MERGED" } });
}

/**
 * Read-only cart resolution for Server Components (pages). Never writes
 * cookies — Next.js forbids cookie writes during RSC render. Returns null
 * when the visitor has no cart yet; creation happens in the actions below.
 */
export async function getActiveCart() {
  const session = await getSession();
  const jar = await cookies();
  const anonId = jar.get(ANON_CART_COOKIE)?.value;

  if (session) {
    let userCart = await db.cart.findFirst({
      where: { userId: session.user.id, status: "ACTIVE" },
      include: { items: true },
    });
    if (userCart && anonId) {
      await mergeAnonCart(anonId, userCart);
    } else if (!userCart && anonId) {
      // Adopt the anonymous cart on first signed-in view (DB write only).
      const anonCart = await db.cart.findFirst({
        where: { anonymousId: anonId, status: "ACTIVE", userId: null },
      });
      if (anonCart) {
        await db.cart.update({
          where: { id: anonCart.id },
          data: { userId: session.user.id },
        });
      }
    }
    userCart = await db.cart.findFirst({
      where: { userId: session.user.id, status: "ACTIVE" },
      include: { items: true },
    });
    return userCart;
  }

  if (!anonId) return null;
  return db.cart.findFirst({
    where: { anonymousId: anonId, status: "ACTIVE" },
    include: { items: true },
  });
}

/**
 * Resolves or CREATES the active cart. Sets the anonymous-cart cookie, so it
 * must only run inside Server Actions / Route Handlers — pages use
 * getActiveCart() instead.
 */
export async function getOrCreateActiveCart() {
  const existing = await getActiveCart();
  if (existing) return existing;

  const session = await getSession();
  if (session) {
    return db.cart.create({
      data: { userId: session.user.id, status: "ACTIVE" },
      include: { items: true },
    });
  }

  const jar = await cookies();
  const newAnonId = nanoid();
  jar.set(ANON_CART_COOKIE, newAnonId, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return db.cart.create({
    data: { anonymousId: newAnonId, status: "ACTIVE" },
    include: { items: true },
  });
}

const addToCartSchema = z.object({
  itemType: z.enum(["COURSE", "COHORT_SEAT", "PROJECT", "PLAN"]),
  courseId: z.string().optional(),
  cohortId: z.string().optional(),
  projectId: z.string().optional(),
  planId: z.string().optional(),
  mentorLevel: z.enum(["ASSOCIATE", "SENIOR", "PRINCIPAL"]).optional(),
});

export const addToCart = actionClient
  .inputSchema(addToCartSchema)
  .action(async ({ parsedInput }) => {
    const targetId =
      parsedInput.courseId ??
      parsedInput.cohortId ??
      parsedInput.projectId ??
      parsedInput.planId;
    if (!targetId) throw new ActionError("Nothing to add.");

    const cart = await getOrCreateActiveCart();
    const dup = cart.items.some(
      (i) =>
        (parsedInput.courseId && i.courseId === parsedInput.courseId) ||
        (parsedInput.cohortId && i.cohortId === parsedInput.cohortId) ||
        (parsedInput.projectId && i.projectId === parsedInput.projectId) ||
        (parsedInput.planId && i.planId === parsedInput.planId),
    );
    if (dup) throw new ActionError("Already in your cart.");

    await db.cartItem.create({
      data: {
        cartId: cart.id,
        itemType: parsedInput.itemType,
        courseId: parsedInput.courseId,
        cohortId: parsedInput.cohortId,
        projectId: parsedInput.projectId,
        planId: parsedInput.planId,
        metadata: parsedInput.mentorLevel
          ? { mentorLevel: parsedInput.mentorLevel }
          : undefined,
      },
    });
    revalidatePath("/cart");
    return { ok: true };
  });

export const removeFromCart = actionClient
  .inputSchema(z.object({ cartItemId: z.string().min(1) }))
  .action(async ({ parsedInput }) => {
    const cart = await getOrCreateActiveCart();
    const item = cart.items.find((i) => i.id === parsedInput.cartItemId);
    if (!item) throw new ActionError("Item not found.");
    await db.cartItem.delete({ where: { id: item.id } });
    revalidatePath("/cart");
    return { ok: true };
  });
