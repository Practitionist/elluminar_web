import type { TenantType } from "@/generated/prisma/enums";

/**
 * Tenant-type-driven vocabulary — one engine, two presentations.
 * Roles/data are identical across tenant types; only the words change.
 */
const LABELS: Record<
  TenantType,
  { member: string; members: string; instructor: string; org: string }
> = {
  CREATOR: { member: "Member", members: "Members", instructor: "Instructor", org: "School" },
  ENTERPRISE: {
    member: "Employee",
    members: "Employees",
    instructor: "Facilitator",
    org: "Company",
  },
  UNIVERSITY: {
    member: "Student",
    members: "Students",
    instructor: "Faculty",
    org: "University",
  },
  HIRING_PARTNER: {
    member: "Member",
    members: "Members",
    instructor: "Recruiter",
    org: "Company",
  },
};

export function tenantLabels(type: TenantType) {
  return LABELS[type] ?? LABELS.CREATOR;
}
