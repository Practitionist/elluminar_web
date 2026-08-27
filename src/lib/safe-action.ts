import * as Sentry from "@sentry/nextjs";
import { createSafeActionClient } from "next-safe-action";

import { CONTENT_TEAM_ROLES, type OrgRole } from "@/lib/auth/roles";
import { getSession, requireTenantMember } from "@/lib/auth/session";

export class ActionError extends Error {}

/**
 * Flattens next-safe-action's default ("formatted") validation-error tree into
 * `{ field: firstMessage }` for the `<Field>` primitive.
 *
 * We read the default shape rather than setting `defaultValidationErrorsShape:
 * "flattened"` because that is a `createSafeActionClient` option, not a
 * chainable one — switching it would change the result type of all ~51 existing
 * actions in a PR that has nothing to do with them.
 *
 * Nested paths are joined with "." so `{ socials: { website: {...} } }` surfaces
 * as `socials.website`, matching how the forms name those inputs.
 */
export function fieldErrors(
  validationErrors: unknown,
  prefix = "",
): Record<string, string> {
  if (!validationErrors || typeof validationErrors !== "object") return {};
  const out: Record<string, string> = {};

  for (const [key, value] of Object.entries(validationErrors)) {
    if (key === "_errors") {
      // `_errors` at the root is a form-level error, not a field one.
      if (prefix && Array.isArray(value) && value.length > 0) out[prefix] = String(value[0]);
      continue;
    }
    Object.assign(out, fieldErrors(value, prefix ? `${prefix}.${key}` : key));
  }
  return out;
}

/** Form-level (non-field) validation messages, e.g. from a schema-wide refine. */
export function formError(validationErrors: unknown): string | undefined {
  if (!validationErrors || typeof validationErrors !== "object") return undefined;
  const root = (validationErrors as { _errors?: unknown })._errors;
  return Array.isArray(root) && root.length > 0 ? String(root[0]) : undefined;
}

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
export function tenantActionClient(allowedRoles: readonly OrgRole[] = CONTENT_TEAM_ROLES) {
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
