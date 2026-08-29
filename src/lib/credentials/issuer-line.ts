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
