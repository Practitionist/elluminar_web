import type { TenantType } from "@/generated/prisma/enums";

/**
 * Tenant-type authorization.
 *
 * `Tenant.type` decides which *surface* a tenant belongs to, and the surfaces
 * are not interchangeable: the creator studio authors and prices catalog
 * courses, the org portal buys licenses and manages a roster. Membership and
 * org role say nothing about this — a university's `owner` is a legitimate
 * member of a legitimate tenant, and would sail through a membership+role gate
 * on `/studio/<their-slug>` and start authoring marketplace courses.
 *
 * Hiding the surface in the sidebar (`lib/nav/surfaces.ts`) is UX, not
 * authorization — the URL is still typeable. This is the same class of hole as
 * the grading one closed in #67, where any org member could grade a peer
 * because only the UI hid the button. Keep the predicate pure and in one place
 * so the route guard, the server-action guard and the tests can't drift.
 */

/** Tenant types that may open the creator studio (`/studio/**`). */
export const STUDIO_TENANT_TYPES = ["CREATOR"] as const satisfies readonly TenantType[];

/** Tenant types that may open the org portal (`/org/**`). */
export const ORG_TENANT_TYPES = [
  "ENTERPRISE",
  "UNIVERSITY",
] as const satisfies readonly TenantType[];

export function canAccessTenantType(input: {
  tenantType: TenantType;
  /** Omitted (or empty) means the caller imposes no type constraint. */
  allowedTypes?: readonly TenantType[];
  isPlatformAdmin: boolean;
  /** `showAllSurfaces()` — true only on deploy-preview/branch-deploy. */
  previewMode: boolean;
}): boolean {
  const { tenantType, allowedTypes, isPlatformAdmin, previewMode } = input;
  if (!allowedTypes || allowedTypes.length === 0) return true;
  // Platform staff keep their global override; preview deploys open every
  // dashboard from one login so the product can be reviewed. Production with a
  // real user hits the strict path below.
  if (isPlatformAdmin || previewMode) return true;
  return allowedTypes.includes(tenantType);
}

/**
 * The surface a tenant of this type actually belongs to — where a denied user
 * is sent, so a wrong-surface URL lands on the right dashboard instead of a
 * dead end. HIRING_PARTNER has no dashboard yet, so it falls back to /learn.
 */
export function tenantHomePath(tenantSlug: string, tenantType: TenantType): string {
  switch (tenantType) {
    case "CREATOR":
      return `/studio/${tenantSlug}`;
    case "ENTERPRISE":
    case "UNIVERSITY":
      return `/org/${tenantSlug}`;
    default:
      return "/learn";
  }
}
