import { describe, expect, it } from "vitest";

import type { TenantType } from "@/generated/prisma/enums";
import {
  canAccessTenantType,
  ORG_TENANT_TYPES,
  STUDIO_TENANT_TYPES,
  tenantHomePath,
} from "@/lib/auth/tenant-access";

/**
 * Regression cover for #47: `requireTenantMember` checked organization
 * membership and org role but never `Tenant.type`, so a UNIVERSITY member could
 * open `/studio/<their-slug>` — the creator studio — and author courses there.
 * The sidebar already hid the surface; the URL was still typeable. Same class
 * of nav-gated-but-not-route-gated hole as the grading one closed in #67.
 */

const ALL_TYPES: readonly TenantType[] = [
  "CREATOR",
  "ENTERPRISE",
  "UNIVERSITY",
  "HIRING_PARTNER",
];

describe("canAccessTenantType — creator studio (/studio/**)", () => {
  const cases: Array<[TenantType, boolean]> = [
    ["CREATOR", true],
    // The hole this closes: an org tenant must never reach the studio.
    ["UNIVERSITY", false],
    ["ENTERPRISE", false],
    ["HIRING_PARTNER", false],
  ];

  it.each(cases)("%s → %s", (tenantType, expected) => {
    expect(
      canAccessTenantType({
        tenantType,
        allowedTypes: STUDIO_TENANT_TYPES,
        isPlatformAdmin: false,
        previewMode: false,
      }),
    ).toBe(expected);
  });
});

describe("canAccessTenantType — org portal (/org/**)", () => {
  const cases: Array<[TenantType, boolean]> = [
    ["UNIVERSITY", true],
    ["ENTERPRISE", true],
    ["CREATOR", false],
    ["HIRING_PARTNER", false],
  ];

  it.each(cases)("%s → %s", (tenantType, expected) => {
    expect(
      canAccessTenantType({
        tenantType,
        allowedTypes: ORG_TENANT_TYPES,
        isPlatformAdmin: false,
        previewMode: false,
      }),
    ).toBe(expected);
  });
});

describe("canAccessTenantType — escape hatches", () => {
  it.each(ALL_TYPES)("platform admin opens the studio on a %s tenant", (tenantType) => {
    expect(
      canAccessTenantType({
        tenantType,
        allowedTypes: STUDIO_TENANT_TYPES,
        isPlatformAdmin: true,
        previewMode: false,
      }),
    ).toBe(true);
  });

  it.each(ALL_TYPES)("platform admin opens the org portal on a %s tenant", (tenantType) => {
    expect(
      canAccessTenantType({
        tenantType,
        allowedTypes: ORG_TENANT_TYPES,
        isPlatformAdmin: true,
        previewMode: false,
      }),
    ).toBe(true);
  });

  // Preview deploys expose every dashboard from one login so the whole product
  // can be reviewed; `showAllSurfaces()` is false in production, so this branch
  // is unreachable there.
  it.each(ALL_TYPES)("preview deploys unlock every surface for a %s tenant", (tenantType) => {
    expect(
      canAccessTenantType({
        tenantType,
        allowedTypes: STUDIO_TENANT_TYPES,
        isPlatformAdmin: false,
        previewMode: true,
      }),
    ).toBe(true);
    expect(
      canAccessTenantType({
        tenantType,
        allowedTypes: ORG_TENANT_TYPES,
        isPlatformAdmin: false,
        previewMode: true,
      }),
    ).toBe(true);
  });
});

describe("canAccessTenantType — no constraint", () => {
  it.each(ALL_TYPES)("an omitted allowedTypes imposes nothing (%s)", (tenantType) => {
    expect(
      canAccessTenantType({ tenantType, isPlatformAdmin: false, previewMode: false }),
    ).toBe(true);
  });

  it("treats an empty allowedTypes as no constraint, not as deny-all", () => {
    expect(
      canAccessTenantType({
        tenantType: "CREATOR",
        allowedTypes: [],
        isPlatformAdmin: false,
        previewMode: false,
      }),
    ).toBe(true);
  });
});

describe("tenantHomePath", () => {
  const cases: Array<[TenantType, string]> = [
    ["CREATOR", "/studio/acme"],
    ["ENTERPRISE", "/org/acme"],
    ["UNIVERSITY", "/org/acme"],
    // No hiring-partner dashboard exists yet — never dead-end on a 404.
    ["HIRING_PARTNER", "/learn"],
  ];

  it.each(cases)("%s → %s", (tenantType, expected) => {
    expect(tenantHomePath("acme", tenantType)).toBe(expected);
  });

  it("sends a denied tenant to a surface that will actually accept it", () => {
    for (const tenantType of ALL_TYPES) {
      const home = tenantHomePath("acme", tenantType);
      if (home.startsWith("/studio/")) {
        expect(
          canAccessTenantType({
            tenantType,
            allowedTypes: STUDIO_TENANT_TYPES,
            isPlatformAdmin: false,
            previewMode: false,
          }),
        ).toBe(true);
      } else if (home.startsWith("/org/")) {
        expect(
          canAccessTenantType({
            tenantType,
            allowedTypes: ORG_TENANT_TYPES,
            isPlatformAdmin: false,
            previewMode: false,
          }),
        ).toBe(true);
      }
    }
  });
});

describe("surface type lists", () => {
  it("keeps the studio and the org portal disjoint", () => {
    for (const t of STUDIO_TENANT_TYPES) {
      expect(ORG_TENANT_TYPES).not.toContain(t);
    }
  });
});
