/**
 * Pure helpers for rendering next-safe-action validation results.
 *
 * Deliberately NOT in `lib/safe-action.ts`: that module imports
 * `lib/auth/session`, which is `server-only`. A client form importing these
 * from there would drag the session helpers — and through them the Prisma
 * client — into the browser bundle, which fails the build.
 */

/**
 * Flattens next-safe-action's default ("formatted") validation-error tree into
 * `{ field: firstMessage }` for the `<Field>` primitive.
 *
 * We read the default shape rather than setting `defaultValidationErrorsShape:
 * "flattened"` because that is a `createSafeActionClient` option, not a
 * chainable one — switching it would change the result type of all ~51 existing
 * actions in a PR that has nothing to do with them.
 *
 * Nested paths join with "." so `{ socials: { website: {...} } }` surfaces as
 * `socials.website`, matching how those inputs are named.
 */
export function fieldErrors(
  validationErrors: unknown,
  prefix = "",
): Record<string, string> {
  if (!validationErrors || typeof validationErrors !== "object") return {};
  const out: Record<string, string> = {};

  for (const [key, value] of Object.entries(validationErrors)) {
    if (key === "_errors") {
      // `_errors` at the root is a form-level error, not a field one.
      if (prefix && Array.isArray(value) && value.length > 0) {
        out[prefix] = String(value[0]);
      }
      continue;
    }
    Object.assign(out, fieldErrors(value, prefix ? `${prefix}.${key}` : key));
  }
  return out;
}

/** Form-level (non-field) validation message, e.g. from a schema-wide refine. */
export function formError(validationErrors: unknown): string | undefined {
  if (!validationErrors || typeof validationErrors !== "object") return undefined;
  const root = (validationErrors as { _errors?: unknown })._errors;
  return Array.isArray(root) && root.length > 0 ? String(root[0]) : undefined;
}
