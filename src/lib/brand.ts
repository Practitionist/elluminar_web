/**
 * Single source of truth for the visible brand wordmark. Change `name` here to
 * rebrand the marketing chrome in one edit.
 */
export const BRAND = {
  name: "elluminar",
  tagline: "Learn by building, verified by mentors.",
  // Legal/contact points surfaced on /terms, /privacy, /refund-policy, /contact.
  // Placeholders until the real brand + entity land (issue #37) — update alongside `name`.
  legalEntity: "elluminar (entity name pending incorporation details)",
  supportEmail: "support@example.com",
  grievanceEmail: "grievance@example.com",
  registeredAddress: "Registered address pending — update before launch (issue #37)",
} as const;
