import { afterEach, describe, expect, it, vi } from "vitest";

async function withContext(value: string | undefined) {
  vi.resetModules();
  delete process.env.NEXT_PUBLIC_DEPLOY_CONTEXT;
  delete process.env.CONTEXT;
  if (value !== undefined) process.env.NEXT_PUBLIC_DEPLOY_CONTEXT = value;
  return import("@/lib/sentry-env");
}

afterEach(() => {
  delete process.env.NEXT_PUBLIC_DEPLOY_CONTEXT;
  delete process.env.CONTEXT;
  delete process.env.NEXT_PUBLIC_SENTRY_FORCE_ENABLE;
});

describe("sentryEnabled", () => {
  it("reports from every real Netlify deploy context", async () => {
    // The whole point of the change: production and preview must stay captured.
    expect((await withContext("production")).sentryEnabled()).toBe(true);
    expect((await withContext("deploy-preview")).sentryEnabled()).toBe(true);
    expect((await withContext("branch-deploy")).sentryEnabled()).toBe(true);
  });

  it("stays silent on a laptop", async () => {
    // `next dev` sets no CONTEXT; `netlify dev` sets CONTEXT=dev.
    expect((await withContext(undefined)).sentryEnabled()).toBe(false);
    expect((await withContext("dev")).sentryEnabled()).toBe(false);
  });

  it("stays silent when the context is unrecognised", async () => {
    // Allowlist, not `!== "local"`: a typo must fall through to disabled rather
    // than let a misconfigured build flood the production project.
    expect((await withContext("")).sentryEnabled()).toBe(false);
    expect((await withContext("Production")).sentryEnabled()).toBe(false);
    expect((await withContext("deploy_preview")).sentryEnabled()).toBe(false);
  });

  it("can be forced on locally for deliberate testing", async () => {
    process.env.NEXT_PUBLIC_SENTRY_FORCE_ENABLE = "true";
    expect((await withContext(undefined)).sentryEnabled()).toBe(true);
  });

  it("is not forced on by any other value", async () => {
    process.env.NEXT_PUBLIC_SENTRY_FORCE_ENABLE = "1";
    expect((await withContext(undefined)).sentryEnabled()).toBe(false);
  });
});

describe("sentryEnvironment", () => {
  it("separates previews from production", async () => {
    // LMS_WEB-J was a deploy-preview error tagged `production` because no
    // environment was set at all.
    expect((await withContext("production")).sentryEnvironment()).toBe("production");
    expect((await withContext("deploy-preview")).sentryEnvironment()).toBe("preview");
    expect((await withContext("branch-deploy")).sentryEnvironment()).toBe("branch-deploy");
  });

  it("labels anything local as development", async () => {
    expect((await withContext(undefined)).sentryEnvironment()).toBe("development");
    expect((await withContext("dev")).sentryEnvironment()).toBe("development");
    expect((await withContext("nonsense")).sentryEnvironment()).toBe("development");
  });
});
