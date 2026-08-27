/**
 * The one slugifier. Three divergent copies previously lived in the onboarding,
 * creator-application and SSO-provider forms; the SSO copy skipped the
 * repeated-hyphen collapse, so "Acme  Corp" produced "acme--corp" — which then
 * failed `slugSchema` server-side with an error the form couldn't explain.
 *
 * Output satisfies `slugSchema` in `@/lib/validation/tenant` (lowercase
 * alphanumerics separated by single hyphens) for any input containing at least
 * one alphanumeric character; returns "" otherwise, which the schema rejects
 * with a message the user can act on.
 */
export function slugify(value: string, maxLength = 48): string {
  return (
    value
      .normalize("NFKD")
      // Strip combining marks so "Café" slugs to "cafe" rather than losing the é.
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      // Separators become hyphens BEFORE the strip. The original ran these the
      // other way round, so underscores were deleted rather than converted and
      // "Acme___Corp" slugged to "acmecorp".
      .replace(/[\s_]+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .slice(0, maxLength)
      // The slice can leave a trailing hyphen behind; slugSchema rejects those.
      .replace(/^-+|-+$/g, "")
  );
}
