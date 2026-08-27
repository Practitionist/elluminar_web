# ADR 003 — SCIM 2.0: designed, deliberately not built

**Status:** accepted (design only) · 2026-08-27
**Build trigger:** a signed or near-signed customer above ~100 seats who names
SCIM as a requirement.

## Why not now

SCIM automates what CSV roster import already does: creating, updating and
deactivating learner accounts from the customer's directory. The difference is
who does it and how often — SCIM is continuous and unattended, CSV is an admin
uploading a file when the roster changes.

For every customer we currently have, that difference is not worth:

- **New Prisma tables** — a provisioning-token table at minimum, plus a
  Groups↔cohort mapping. This is the only part of the enterprise SSO work that
  cannot be done under the schema freeze (issue #43); it would need a
  `schema-approved` label and founder sign-off.
- **A long-lived bearer credential per organization**, which becomes a
  standing account-creation capability if it leaks.
- **Directory drift as a support surface.** Once provisioning is automatic,
  "why did this person lose access" becomes our problem to debug inside the
  customer's directory.

Deactivation is the one place SCIM is genuinely better — a departing employee
loses access in minutes rather than at the next roster upload. That is the
argument to watch for; it is a real compliance ask above a few hundred seats.

## The design, for when it is time

### Endpoints

Org-scoped, under a token that identifies the organization:

```
GET    /api/scim/v2/{orgToken}/Users
POST   /api/scim/v2/{orgToken}/Users
GET    /api/scim/v2/{orgToken}/Users/{id}
PATCH  /api/scim/v2/{orgToken}/Users/{id}
DELETE /api/scim/v2/{orgToken}/Users/{id}

GET    /api/scim/v2/{orgToken}/Groups
POST   /api/scim/v2/{orgToken}/Groups
PATCH  /api/scim/v2/{orgToken}/Groups/{id}
```

These are the only auth routes we would ever add outside Better Auth's
catch-all, because SCIM is a machine-to-machine API with its own bearer scheme
and its own RFC 7644 error envelope.

`{orgToken}` in the path is a routing key, **not** the credential. The
credential is `Authorization: Bearer <secret>`, compared in constant time
against a hash. Putting a secret in a URL path would leak it into every access
log and Referer header on the way.

### Schema (needs `schema-approved`)

```prisma
model ScimToken {
  id             String    @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  publicId       String    @unique  // the {orgToken} path segment
  tokenHash      String              // argon2/scrypt of the bearer secret
  label          String
  createdById    String
  lastUsedAt     DateTime?
  revokedAt      DateTime?
  createdAt      DateTime  @default(now())

  @@index([organizationId])
}
```

Reuse `LicenseSeat` for entitlement; do not invent a parallel one.

### Mapping

| SCIM | Ours |
|---|---|
| `User.userName` / `emails[primary]` | `User.email` — the join key, matched case-insensitively |
| `User.name.givenName` + `familyName` | `User.name` |
| `User.active: false` | Revoke the `LicenseSeat` (via `revokeSeatCore`, which already cascades enrolments) and soft-remove the `Member` row |
| `User.externalId` | Stored for idempotency; never trusted as identity |
| `Group` | A `ProgramCohort`, or a roster batch |
| `Group.members` | `LicenseSeat` assignment within that cohort |

### Rules that matter

1. **SCIM provisions seats, never platform roles.** `User.role` is ours; the
   customer's directory does not get to write it. Same reasoning as
   `defaultRole: "member"` in [ADR 002](./adr-002-enterprise-sso.md).
2. **`active: false` revokes, it does not delete.** We anonymise rather than
   delete users (`User.anonymizedAt`), and credentials already earned must
   survive a seat being reclaimed.
3. **Idempotent by email.** Directories replay. A `POST /Users` for an existing
   email is a `200` against the existing record, not a duplicate and not a `409`.
4. **Deactivation must not orphan work in flight.** A learner mid-milestone
   loses access to start new work but keeps their submission history, exactly as
   `revokeSeatCore` behaves today.
5. **Rate limit and audit per token.** Every mutation writes an `AuditLog` row
   with `actorKind: "SYSTEM"` and the token's `publicId`.

### Rollout

1. `Users` only, read + create + deactivate. That is ~90% of the value.
2. `Groups`, once a customer actually maps directory groups to cohorts.
3. `PATCH` with full RFC 7644 filter syntax last — it is the fiddliest part and
   most IdPs use a small subset.

Okta and Entra ID both certify against a conformance suite; budget time for
their test runs, not just for the endpoints.
