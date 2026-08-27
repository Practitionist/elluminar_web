# Runbook — onboarding an enterprise customer's SSO

For whoever is on the call with the customer's IT team. Everything the customer
needs is on their own **Organization settings → Single sign-on** page; they
should not need us to read URLs to them.

Placeholders below: `{app}` is the deployment origin (production:
`https://elluminar.com`), `{providerId}` is the identifier the org chooses at
registration.

---

## The shape of it

1. Org owner or admin registers the provider in our UI.
2. **Nothing works yet.** The provider is inert until the domain is verified.
3. They publish one DNS TXT record and click verify.
4. Employees sign in with their work email.

Step 2 is the one that surprises people. Say it early.

---

## OIDC (Okta, Entra ID, Google Workspace, JumpCloud, Auth0)

**On our side**, in Organization settings → Single sign-on → Register:

| Field | What it is |
|---|---|
| Provider id | Lowercase slug, e.g. `acme-okta`. Appears in the callback URL, so pick it before configuring the IdP |
| Email domain | The bare domain, e.g. `acme.com`. Public providers (gmail.com, outlook.com, …) are rejected |
| Issuer URL | e.g. `https://acme.okta.com`. Must be https |
| Client ID / secret | From the IdP application |

We fetch `{issuer}/.well-known/openid-configuration` **before saving** and
refuse anything that 404s, times out, isn't https, or lacks `issuer`,
`authorization_endpoint`, `token_endpoint` or `jwks_uri`. If registration fails,
the message names the specific problem — read it out; it is usually a typo'd
issuer or a tenant-specific path missing from it.

**On the IdP side**, create a web / OIDC application:

- **Redirect (callback) URI:** `{app}/api/auth/sso/callback/{providerId}`
- **Grant type:** authorization code (PKCE is enabled on our side)
- **Scopes:** `openid`, `email`, `profile`

Per-IdP notes:

- **Okta** — "OIDC — Web Application". Issuer is your org URL, or
  `https://acme.okta.com/oauth2/{authServerId}` for a custom auth server. Use
  the full path; our probe follows it exactly.
- **Entra ID** — issuer is
  `https://login.microsoftonline.com/{tenantId}/v2.0`. Grant admin consent for
  the scopes or the first user hits a consent wall.
- **Google Workspace** — a Google Cloud OAuth client. Issuer is
  `https://accounts.google.com`.

---

## SAML 2.0 (Shibboleth, ADFS, and IdPs without an OIDC app)

**On our side**, choose the SAML tab:

| Field | What it is |
|---|---|
| Provider id | As above |
| Email domain | As above |
| IdP entity ID | The issuer from the IdP's metadata. May be a URL or a URN |
| IdP SSO URL | The HTTP-Redirect SSO endpoint |
| IdP signing certificate | The full PEM block, `BEGIN`/`END` lines included |

**On the IdP side** — every value is copy-to-clipboard on the settings page:

| IdP field | Value |
|---|---|
| ACS / Reply / Consumer URL | `{app}/api/auth/sso/saml2/sp/acs/{providerId}` |
| SP Entity ID / Audience | `{app}/api/auth/sso/saml2/sp/metadata?providerId={providerId}` |
| SP metadata (for import) | `{app}/api/auth/sso/saml2/sp/metadata?providerId={providerId}&format=xml` |
| Single Logout URL | `{app}/api/auth/sso/saml2/sp/slo/{providerId}` |
| NameID format | `emailAddress` |
| Binding | HTTP-POST for the response, HTTP-Redirect for the request |

Requirements we enforce, worth stating up front so their first attempt works:

- **Assertions must be signed**, with **SHA-256 or SHA-512**. SHA-1 is rejected
  outright, not warned about.
- **Assertions must carry `NotBefore` / `NotOnOrAfter`.** Any SAML2Int-conformant
  IdP does this by default. Clock skew tolerance is 2 minutes — if their IdP
  host has drifted, fix NTP rather than asking us to widen it.
- **SP-initiated only.** IdP-initiated sign-in (a tile in the IdP portal) is
  disabled, because a response with no `InResponseTo` cannot be correlated to a
  request we issued and so loses replay protection. If a customer insists,
  that's a deliberate per-customer change plus a note here — see
  [ADR 002](./adr-002-enterprise-sso.md).

---

## Domain verification (both protocols)

Registration returns a token, shown once on screen. If they lose it, "Issue a
new token" — note that this invalidates any record already published.

They add:

| | |
|---|---|
| Type | `TXT` |
| Name / host | `_better-auth-token-{providerId}` (some registrars want the full `_better-auth-token-{providerId}.acme.com`) |
| Value | the token |

Then **"I've published the record"**. Usually minutes; allow up to an hour. If
it fails, have them check with `dig TXT _better-auth-token-{providerId}.acme.com`
before assuming it's us — the most common causes are the registrar appending the
domain twice, or a proxying DNS provider stripping underscore records.

Until this succeeds, every sign-in attempt returns
`Provider domain has not been verified`. That is correct behaviour, not a bug.

### Platform-admin override

`/admin/sso` can grant trust without DNS — for a sales-led customer whose DNS
team is slow. Two things to know:

- It is audited, with the actor and a reason.
- **It closes the DNS route.** Better Auth refuses `verifyDomain` once the
  domain is already verified, so the customer cannot later self-verify unless we
  revoke first. Prefer DNS whenever there is time for it.

Revoking is also how you disable a compromised provider instantly.

---

## First sign-in, and what should happen

The employee goes to `/sign-in` → **Sign in with SSO** → work email → their IdP
→ back to us. On that first sign-in:

1. A `User` is created if none exists. `locale` and `zoneinfo` are copied from
   the IdP claims; nothing else is.
2. A `Member` row is created in the organization with role **`member`** —
   always, regardless of IdP group claims. Elevation happens in our members UI.
3. The session hook claims any `INVITED` license seat matching their verified
   email, so a rostered learner lands with their entitlement already active.

---

## When it goes wrong

| Symptom | Cause |
|---|---|
| `Provider domain has not been verified` | Expected until step 3 completes |
| `No verified identity provider is configured for that email domain` | Domain mismatch — the user's email domain isn't the registered one (subsidiaries need their own provider, or a comma-separated multi-domain registration) |
| IdP shows "invalid ACS URL" / audience mismatch | Typo in the ACS or Entity ID. Have them re-import our metadata XML rather than retyping |
| SAML response rejected, signature invalid | Wrong certificate, or the IdP rotated its signing key. Re-paste the PEM |
| SAML response rejected, timestamps | Their IdP omits `NotBefore`/`NotOnOrAfter`, or its clock has drifted more than 2 minutes |
| User lands signed in but in no organization | Provider registered without an `organizationId` — re-register from within the org's settings page, not `/admin` |
| Learner has no course access after SSO | Seat claim needs a **verified** email; SSO sets `emailVerified` from the IdP only when the claim is present |

Every registration, verification and revocation writes an `AuditLog` row against
`entityType: "SsoProvider"`. `/admin/sso` shows the most recent event per
provider; query the table directly for the full history.
