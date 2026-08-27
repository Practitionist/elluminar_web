/**
 * Organization role helpers.
 *
 * BetterAuth's organization plugin stores a member's roles as a single
 * comma-separated string ("owner,instructor") and treats a member as authorized
 * when ANY one of those roles matches. Every check must therefore split before
 * comparing — a bare `role === "instructor"` silently denies "instructor,member".
 *
 * Keeping the split in one place also means a role rename breaks in one file
 * instead of drifting between the nav, the route guard and the server action.
 */

export type OrgRole = "owner" | "admin" | "instructor" | "member";

/** Roles that may author course content and grade learner work. */
export const CONTENT_TEAM_ROLES = ["owner", "admin", "instructor"] as const;

export function parseOrgRoles(role: string | null | undefined): string[] {
  if (!role) return [];
  return role
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);
}

export function hasOrgRole(role: string | null | undefined, allowed: readonly OrgRole[]): boolean {
  const roles = parseOrgRoles(role);
  return allowed.some((a) => roles.includes(a));
}

/**
 * Grading authority.
 *
 * Platform staff keep a global override. Everyone else needs an explicit
 * content-team role: plain `member` must never grade, because enterprise and
 * university learners are provisioned as org members (seat claim on sign-in,
 * SSO JIT membership) and would otherwise be able to grade their peers.
 */
export function canGrade(input: {
  membershipRole: string | null | undefined;
  isPlatformAdmin: boolean;
}): boolean {
  if (input.isPlatformAdmin) return true;
  return hasOrgRole(input.membershipRole, CONTENT_TEAM_ROLES);
}
