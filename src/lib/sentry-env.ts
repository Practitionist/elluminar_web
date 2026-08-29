import { deployContext } from "./deploy-context";

/**
 * Where Sentry reports, and whether it reports at all.
 *
 * Both answers are derived from the Netlify deploy context (see
 * `deploy-context.ts`) rather than from `NODE_ENV`, because `NODE_ENV` cannot
 * tell the three cases apart that matter here: a Netlify production deploy, a
 * Netlify preview deploy, and a local `next build && next start`. All three are
 * `NODE_ENV === "production"`.
 *
 * Why this exists: every Sentry config used to fall back to a hard-coded DSN and
 * set no `environment`, so a local `pnpm dev` reported into the production Sentry
 * project tagged `environment: development`. Over 30 days that was 563 local
 * events against 2 real ones, and PR previews were mislabelled `production`.
 */

/** Sentry's `environment` tag. Distinct per deploy context so previews are filterable. */
export type SentryEnvironment = "production" | "preview" | "branch-deploy" | "development";

export function sentryEnvironment(): SentryEnvironment {
  switch (deployContext()) {
    case "production":
      return "production";
    case "deploy-preview":
      return "preview";
    case "branch-deploy":
      return "branch-deploy";
    // `dev` (netlify dev) and `local` (plain `next dev`) are both a laptop.
    default:
      return "development";
  }
}

/**
 * Only real Netlify deploys ship events.
 *
 * An allowlist, not `!== "local"`: an unrecognised or missing CONTEXT falls
 * through to *disabled*, so the failure mode of a misconfigured build is silence
 * in Sentry rather than a laptop flooding the production project.
 *
 * Escape hatch: set `NEXT_PUBLIC_SENTRY_FORCE_ENABLE=true` to exercise Sentry
 * locally. It is `NEXT_PUBLIC_` so the same switch works on both client and
 * server; Next inlines it at build time.
 */
export function sentryEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_SENTRY_FORCE_ENABLE === "true") return true;
  const ctx = deployContext();
  return ctx === "production" || ctx === "deploy-preview" || ctx === "branch-deploy";
}
