import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";

/**
 * Organization-scoped access control statements.
 * These govern what members of a tenant (creator team / enterprise org) can do.
 * Platform-level roles (user/support/admin) live on User.role via the admin plugin.
 */
export const statement = {
  ...defaultStatements,
  course: ["create", "update", "delete", "publish"],
  project: ["create", "update", "delete", "publish"],
  cohort: ["create", "update", "delete"],
  liveSession: ["create", "update", "cancel"],
  pricing: ["manage"],
  coupon: ["manage"],
  earnings: ["view"],
  payout: ["request"],
  learner: ["view", "message"],
  announcement: ["create"],
  program: ["manage"],
  roster: ["manage"],
  reports: ["view"],
  storefront: ["manage"],
} as const;

export const ac = createAccessControl(statement);

const allContentPermissions = {
  course: [...statement.course],
  project: [...statement.project],
  cohort: [...statement.cohort],
  liveSession: [...statement.liveSession],
  announcement: [...statement.announcement],
} as const;

/** Full control, including org deletion and payout requests. */
export const owner = ac.newRole({
  ...ownerAc.statements,
  ...allContentPermissions,
  pricing: ["manage"],
  coupon: ["manage"],
  earnings: ["view"],
  payout: ["request"],
  learner: ["view", "message"],
  program: ["manage"],
  roster: ["manage"],
  reports: ["view"],
  storefront: ["manage"],
});

/** Everything except org deletion / payout requests. */
export const orgAdmin = ac.newRole({
  ...adminAc.statements,
  ...allContentPermissions,
  pricing: ["manage"],
  coupon: ["manage"],
  earnings: ["view"],
  learner: ["view", "message"],
  program: ["manage"],
  roster: ["manage"],
  reports: ["view"],
  storefront: ["manage"],
});

/** Co-instructor / TA: authoring + teaching, no commerce controls. */
export const instructor = ac.newRole({
  course: ["create", "update", "publish"],
  cohort: ["create", "update"],
  liveSession: ["create", "update", "cancel"],
  announcement: ["create"],
  learner: ["view", "message"],
});

/** Plain member (e.g. enterprise learner rostered into an org). */
export const member = ac.newRole({
  ...memberAc.statements,
});

export const orgRoles = { owner, admin: orgAdmin, instructor, member };

/** Platform staff roles stored on User.role (admin plugin). */
export const PLATFORM_ROLES = ["user", "support", "admin"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];
