import { afterEach, describe, expect, it, vi } from "vitest";

async function withContext(value: string | undefined) {
  vi.resetModules();
  if (value === undefined) {
    delete process.env.NEXT_PUBLIC_DEPLOY_CONTEXT;
    delete process.env.CONTEXT;
  } else {
    process.env.NEXT_PUBLIC_DEPLOY_CONTEXT = value;
  }
  return import("@/lib/deploy-context");
}

afterEach(() => {
  delete process.env.NEXT_PUBLIC_DEPLOY_CONTEXT;
  delete process.env.CONTEXT;
});

describe("showAllSurfaces", () => {
  it("unlocks every dashboard on PR previews and branch deploys", async () => {
    expect((await withContext("deploy-preview")).showAllSurfaces()).toBe(true);
    expect((await withContext("branch-deploy")).showAllSurfaces()).toBe(true);
  });

  it("NEVER unlocks in production", async () => {
    expect((await withContext("production")).showAllSurfaces()).toBe(false);
  });

  it("stays strict when the context is missing or unrecognised", async () => {
    // Allowlist, not `!== "production"`: a typo, an empty string or a missing
    // variable must fall through to the strict path rather than open everything.
    expect((await withContext(undefined)).showAllSurfaces()).toBe(false);
    expect((await withContext("")).showAllSurfaces()).toBe(false);
    expect((await withContext("Production")).showAllSurfaces()).toBe(false);
    expect((await withContext("prod")).showAllSurfaces()).toBe(false);
    expect((await withContext("deploy_preview")).showAllSurfaces()).toBe(false);
  });

  it("labels previews and says nothing in production", async () => {
    expect((await withContext("deploy-preview")).previewContextLabel()).toContain("Deploy preview");
    expect((await withContext("production")).previewContextLabel()).toBeNull();
    expect((await withContext(undefined)).previewContextLabel()).toBeNull();
  });
});
