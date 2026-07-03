"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { nanoid } from "nanoid";
import { z } from "zod";

import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ActionError, actionClient } from "@/lib/safe-action";

const ANON_CART_COOKIE = "lms_cart";

/** Resolves (or creates) the active cart for the current user/browser. */
export async function getOrCreateActiveCart() {
  const session = await getSession();
  const jar = await cookies();
  const anonId = jar.get(ANON_CART_COOKIE)?.value;

  if (session) {
    const existing = await db.cart.findFirst({
      where: { userId: session.user.id, status: "ACTIVE" },
      include: { items: true },
    });
    if (existing) {
      // Merge an anonymous cart into the user cart on sign-in.
      if (anonId) {
        const anonCart = await db.cart.findFirst({
          where: { anonymousId: anonId, status: "ACTIVE", userId: null },
          include: { items: true },
        });
        if (anonCart && anonCart.id !== existing.id) {
          for (const item of anonCart.items) {
            const dup = existing.items.some(
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
              await db.cartItem.update({
                where: { id: item.id },
                data: { cartId: existing.id },
              });
            }
          }
          await db.cart.update({
            where: { id: anonCart.id },
            data: { status: "MERGED" },
          });
        }
      }
      return db.cart.findUniqueOrThrow({
        where: { id: existing.id },
        include: { items: true },
      });
    }
    return db.cart.create({
      data: { userId: session.user.id, status: "ACTIVE" },
      include: { items: true },
    });
  }

  if (anonId) {
    const existing = await db.cart.findFirst({
      where: { anonymousId: anonId, status: "ACTIVE" },
      include: { items: true },
    });
    if (existing) return existing;
  }
  const newAnonId = anonId ?? nanoid();
  if (!anonId) {
    jar.set(ANON_CART_COOKIE, newAnonId, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
  }
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
