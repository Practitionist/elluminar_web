# ADR 002 — Enterprise SSO: SAML now, DNS-verified domains, SCIM deferred

**Status:** accepted · 2026-08-27

## Context

OIDC provider registration existed and was plausibly correct, but had never been
exercised end to end. SAML was advertised in the Prisma schema
(`SsoProvider.samlConfig`) and implemented nowhere — the org settings form said
so out loud. Domain "verification" was a platform admin flipping a boolean by
hand.

Three things had to be decided: whether to build SAML, how a domain gets
trusted, and whether to build SCIM.

## Decision 1 — build SAML now

The internal roadmap (`temp/elluminar-prompts/07-enterprise-sso-scim`)
recommended deferring SAML on the grounds that OIDC covers Okta, Entra ID and
Google Workspace, i.e. most institutional buyers. That reasoning was sound when
written, and we built it anyway, because the cost turned out to be far lower
than assumed:

- **No new dependency.** `samlify` and `fast-xml-parser` ship *inside*
  `@better-auth/sso`.
- **No schema change.** `SsoProvider.samlConfig` already exists, so the PR
  clears CI's `schema-freeze` gate without a `schema-approved` label.
- **No new routes.** Better Auth already mounts `/sso/saml2/sp/acs/:providerId`,
  `/sso/saml2/sp/metadata`, `/sso/saml2/sp/slo/:providerId` and
  `/sso/saml2/logout/:providerId` under the existing catch-all.

What remained was a form, a config mapping, and a place to show IdP admins the
URLs. Against that, "SAML 2.0" on the security-review questionnaire is the
difference between a university procurement conversation continuing or not —
Shibboleth and older ADFS deployments have no OIDC app to offer.

### SAML security posture

Set in the `sso({ saml: … })` block:

| Option | Value | Why |
|---|---|---|
| `enableInResponseToValidation` | `true` | Correlates every response to an AuthnRequest we issued — replay protection |
| `requestTTL` | 5 min | Bounds how long a stolen AuthnRequest id is useful |
| `clockSkew` | 2 min | Tighter than the 5-minute default; enough for NTP drift |
| `allowIdpInitiated` | **`false`** | An IdP-initiated response cannot be correlated to a request we issued, so it loses replay protection |
| `requireTimestamps` | `true` | Okta, Entra ID and OneLogin all follow SAML2Int, which mandates `NotBefore`/`NotOnOrAfter`. Without them an intercepted assertion is valid forever |
| `algorithms.onDeprecated` | `"reject"` | SHA-1, RSA1_5 and 3DES are broken, not merely old |

The registration schema offers no way to *select* a deprecated algorithm:
`signatureAlgorithm` and `digestAlgorithm` are enums of `sha256 | sha512`.

If a customer genuinely needs an IdP-initiated portal tile, `allowIdpInitiated`
must be turned on deliberately and noted against that customer in the runbook —
not enabled globally.

## Decision 2 — DNS verification is primary; the admin toggle is an override

The domain is the whole security boundary: it decides whose employees get
auto-provisioned into which organization. A platform admin ticking a box is not
evidence of ownership.

**The flow now:**

1. Org owner registers a provider. It is inert — Better Auth throws
   `UNAUTHORIZED: "Provider domain has not been verified"` on every sign-in
   attempt while `domainVerified` is false.
2. Registration returns a `domainVerificationToken`. The org publishes it as a
   TXT record at `_better-auth-token-{providerId}.{domain}`.
3. They click verify; Better Auth resolves the record and flips the flag.

> The token was previously **discarded** — `src/actions/org-sso.ts` did
> `void result;`. An org admin could therefore never see the record they needed,
> which made the self-service path unreachable and the manual toggle the only
> way anything ever got verified.

**The platform-admin toggle survives**, repositioned as an override with two
legitimate uses: vouching for a sales-led customer whose DNS team is slow, and
revoking trust in a provider we no longer trust.

There is an asymmetry worth knowing: Better Auth throws `CONFLICT` on
`verifyDomain` once `domainVerified` is true, so **granting via override closes
the org's own DNS route** until it is revoked. The admin UI says this before you
confirm. Separately, `updateSSOProvider` resets `domainVerified` to `false`
whenever the domain changes — correct, and worth not being surprised by.

## Decision 3 — SCIM stays a design, not an implementation

See [ADR 003](./adr-003-scim-design.md). It is the one piece of this that would
require new Prisma tables, and CSV roster import already covers every customer
we have.

## Decision 4 — `organizationProvisioning.defaultRole` stays `member`

Better Auth can map an IdP group claim onto an org role via `getRole`. We
deliberately do not.

An IdP group claim is controlled by the customer's IT team. `member` is the only
role that cannot grade, publish, or spend — see `canGrade()` in
`src/lib/auth/roles.ts`, which exists precisely because enterprise learners hold
a `member` row in the buying org. Elevation stays a deliberate act inside our
own members UI, where it is audited.

`provisionUser` runs on first SSO sign-in and copies only `locale` and
`zoneinfo` from the claims. It never touches `role`, `email` or `emailVerified`,
and a failure there is caught — a profile-field write must not cost someone
their sign-in.

## What we did not do

- **`trustEmailVerified`.** Better Auth deprecates it and warns it can enable
  account takeover. Domain verification is the stronger signal and we have it.
- **`oidcProvider`** — being an IdP ourselves. Not a use case we have.
- **Subdomain / custom-domain tenant routing.** `Tenant.subdomain` and
  `customDomain` exist, are unique-indexed, marked post-MVP, and read by
  nothing. Tenant routing stays path-based.

## Verification

The server-dependent checks are in
[the manual checklist](./verification-checklist.md) — most importantly the
negative one: **a provider with `domainVerified = false` must not authenticate
anyone, through any path.**

Unit-tested without a server: the OIDC/SAML discriminated union, free-mail
domain rejection, the algorithm enums, connection-URL construction, and the
discovery probe's failure modes (`tests/unit/sso-config.test.ts`,
`tests/unit/sso-discovery.test.ts`).
