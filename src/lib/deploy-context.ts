/**
 * Which Netlify deploy context this build is serving.
 *
 * Netlify sets `CONTEXT` on every build: `production` for the production branch,
 * `deploy-preview` for per-PR previews, `branch-deploy` for branch deploys, and
 * `dev` for `netlify dev`. It is absent locally under `next dev`.
 */
export type DeployContext = "production" | "deploy-preview" | "branch-deploy" | "dev" | "local";

export function deployContext(): DeployContext {
  // `CONTEXT` is a Netlify *build* variable and is not guaranteed at request
  // time, so netlify.toml pipes it into NEXT_PUBLIC_DEPLOY_CONTEXT through the
  // build command (their env values are not interpolated). Next inlines
  // NEXT_PUBLIC_* at build, so it is reliably readable in server code too.
  const raw = process.env.NEXT_PUBLIC_DEPLOY_CONTEXT ?? process.env.CONTEXT;
  if (raw === "production" || raw === "deploy-preview" || raw === "branch-deploy" || raw === "dev") {
    return raw;
  }
  return "local";
}

/**
 * Preview builds expose every dashboard from a single login, so the whole
 * product can be reviewed without provisioning five accounts. Production gates
 * strictly on real memberships and roles.
 *
 * Written as an allowlist rather than `!== "production"` on purpose: an
 * unrecognised or missing CONTEXT falls through to the strict path, so the
 * permissive branch can only ever be reached on a context Netlify explicitly
 * told us is a preview. This widens *which dashboards a signed-in user may
 * open* — it never skips authentication.
 */
export function showAllSurfaces(): boolean {
  const ctx = deployContext();
  return ctx === "deploy-preview" || ctx === "branch-deploy";
}

/** Label for the preview banner, so nobody mistakes a preview for production. */
export function previewContextLabel(): string | null {
  switch (deployContext()) {
    case "deploy-preview":
      return "Deploy preview · every dashboard is unlocked for review";
    case "branch-deploy":
      return "Branch deploy · every dashboard is unlocked for review";
    default:
      return null;
  }
}
