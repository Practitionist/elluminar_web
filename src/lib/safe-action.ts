import * as Sentry from "@sentry/nextjs";
import { createSafeActionClient } from "next-safe-action";

import { getSession, requireTenantMember } from "@/lib/auth/session";

export class ActionError extends Error {}

/** Base client: returns ActionError messages verbatim, masks everything else. */
export const actionClient = createSafeActionClient({
  handleServerError(e) {
    if (e instanceof ActionError) return e.message;
    console.error("[action]", e);
    Sentry.captureException(e);
    return "Something went wrong. Please try again.";
  },
});

/** Requires a signed-in user; exposes { session } in ctx. */
export const authActionClient = actionClient.use(async ({ next }) => {
  const session = await getSession();
  if (!session) throw new ActionError("You must be signed in.");
  Sentry.setUser({ id: session.user.id });
  return next({ ctx: { session } });
});

/** Platform staff only. */
export const adminActionClient = authActionClient.use(async ({ next, ctx }) => {
  const role = ctx.session.user.role ?? "user";
  if (role !== "admin") throw new ActionError("Admin access required.");
  return next({ ctx });
});

/**
 * Binds an action to a tenant the caller belongs to. The action's input must
 * include { tenantSlug }; ctx gains { tenant, membership }.
 */
export function tenantActionClient(
  allowedRoles: Array<"owner" | "admin" | "instructor" | "member"> = [
    "owner",
    "admin",
    "instructor",
  ],
) {
  return authActionClient.use(async ({ next, clientInput }) => {
    const tenantSlug = (clientInput as { tenantSlug?: string })?.tenantSlug;
    if (!tenantSlug) throw new ActionError("Missing tenant.");
    const { session, tenant, membership } = await requireTenantMember(
      tenantSlug,
      allowedRoles,
    );
    return next({ ctx: { session, tenant, membership } });
  });
}
