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
/**
 * Platform-staff check (`User.role` from BetterAuth's admin plugin).
 *
 * This literal was repeated at six call sites, two of which omitted the
 * `?? "user"` default. Equivalent today — `undefined === "admin"` is false —
 * but the whole point of the tenant-type work is that route enforcement and
 * nav filtering must never be able to disagree, and two spellings of the same
 * predicate is how that drift starts.
 */
export function isPlatformAdmin(role: string | null | undefined): boolean {
  return (role ?? "user") === "admin";
}

export function canGrade(input: {
  membershipRole: string | null | undefined;
  isPlatformAdmin: boolean;
}): boolean {
  if (input.isPlatformAdmin) return true;
  return hasOrgRole(input.membershipRole, CONTENT_TEAM_ROLES);
}
