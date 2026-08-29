/**
 * The "Issued by …" line on a public credential page.
 *
 * A co-brand is only meaningful when it names a *different* organisation. A
 * program run by the same org that awards it stores the issuer in both places,
 * which rendered the name twice — "Nalanda University × Nalanda University" —
 * on the one page a sceptical employer actually reads.
 */
export function issuerLine(
  issuer: string,
  coBrandPartner?: string | null,
): string {
  const partner = coBrandPartner?.trim();
  if (!partner) return issuer;
  // Case-insensitive: "nalanda university" and "Nalanda University" are the
  // same institution, and credential metadata is hand-entered.
  if (partner.toLowerCase() === issuer.trim().toLowerCase()) return issuer;
  return `${issuer} × ${partner}`;
}

/**
 * Reads the co-brand partner out of a credential's `metadata`.
 *
 * `metadata` is an untyped JSON column, so casting it to `{ coBrandPartner?: string }`
 * is a compile-time promise only: a non-string that reached the row some other way
 * would hit `.trim()` above and 500 the page instead of falling back to the issuer.
 */
export function coBrandPartnerFrom(metadata: unknown): string | null {
  if (typeof metadata !== "object" || metadata === null) return null;
  const value = (metadata as { coBrandPartner?: unknown }).coBrandPartner;
  return typeof value === "string" ? value : null;
}
