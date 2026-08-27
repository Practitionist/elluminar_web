# ADR 001 — Server actions for our data, the auth client for credentials

**Status:** accepted · 2026-08-27

## Context

The codebase had one established mutation pattern — `next-safe-action`, 51
actions across 23 files, built on the client hierarchy in
`src/lib/safe-action.ts` — and a second, unrelated one: the auth pages calling
`authClient.*` directly from client components.

Adding `/account`, the onboarding wizard and SAML registration meant deciding
whether to unify on one, and in which direction. Next.js's own guidance is
agnostic; it says only that a Server Action is a public POST endpoint that must
re-authorize internally, which both patterns can satisfy.

## Decision

**Hybrid, split along a line that is easy to state:**

> If it writes *our* columns, it is a `next-safe-action` server action.
> If it manipulates a credential or a session, it goes through `authClient`.

| Flow | Mechanism |
|---|---|
| Sign in, sign up, password reset, email verification | `authClient` |
| 2FA enrol / verify / disable, session revocation, password change | `authClient` |
| Social and SSO sign-in | `authClient` (must navigate the browser to the IdP) |
| Onboarding steps, profile, notification preferences | server action |
| Email change *request*, SSO provider registration, domain verification | server action |
| Audit records for client-performed security events | server action |

## Why not route credentials through server actions too

It was the obvious unification, and we rejected it for concrete reasons rather
than taste:

1. **Better Auth's client already does work we would have to redo.** The 2FA
   redirect (`twoFactorClient.onTwoFactorRedirect`), `callbackURL` handling, and
   typed error codes are all client-side behaviour. Wrapping `auth.api.*` in an
   action means reimplementing the redirect logic and re-deriving the error
   taxonomy by hand.
2. **Social and SSO cannot be server actions anyway.** They navigate the browser
   to a third-party IdP. Routing password sign-in through an action while
   Google and SSO stay on the client produces a *worse* split than this one —
   inconsistent within a single form rather than consistent along a boundary.
3. **The security argument is a wash.** Server Actions are public POST endpoints
   requiring their own authorization; Better Auth's `/api/auth/*` handler is a
   public endpoint with its own authorization, plus per-endpoint rate limiting
   we already configure. Neither is inherently safer here.

## Why not put onboarding on the auth client

Onboarding writes `User.phone`, `PortfolioProfile.about` and
`NotificationPreference.prefs`. None of that is Better Auth's business, and
`authActionClient` already gives us session context, Sentry user tagging,
consistent error masking, and an `AuditLog` convention every other mutation in
the app follows.

## Consequences

**Good**

- Zero churn on the 51 existing actions.
- One shared zod schema per concept in `src/lib/validation/`, `z.infer`-exported
  and used by both the client's field validation and the action's
  `.inputSchema()`. Sign-up previously had a second, drifting schema literal
  inline in its page.
- Security events performed by the browser still get an audit trail, via a thin
  `recordSecurityEvent` action.

**Costs, accepted**

- Two mechanisms to learn. Mitigated by the one-sentence rule above.
- Credential forms are client components and do not progressively enhance.
  Acceptable: they already require JavaScript for the 2FA redirect.
- `recordSecurityEvent` is advisory. A client that skips it leaves no audit row.
  It records what the user's own browser did, not a security control — the
  actual control is Better Auth's endpoint.

## Implementation notes

**Each auth page is an RSC shell plus a client form.** The server component
reads `searchParams` (a Promise in Next 16) and server-only env flags, then
passes a DTO down. This removed the `<Suspense>` boundaries that had no
fallback and flashed blank, and it is how the sign-in page knows whether Google
is actually configured — `socialProviders` is spread conditionally, so the
button previously rendered and failed on click when it wasn't.

**`fieldErrors`/`formError` live in `src/lib/form-errors.ts`, not
`safe-action.ts`.** They are pure render helpers, but `safe-action.ts` imports
`lib/auth/session`, which is `server-only`; importing them from there pulls the
Prisma client into the browser bundle. `tsc` does not catch this.

**We did not switch `defaultValidationErrorsShape` to `"flattened"`.** It is a
`createSafeActionClient` option, not a chainable one, so flipping it would
change the result type of every existing action. `fieldErrors()` reads the
default formatted tree instead.

**No form library.** The repo's convention is uncontrolled `<form>` + `FormData`
on submit, and adding `react-hook-form` for these screens would have made the
auth pages the odd ones out. The new `<Field>` primitive supplies what was
actually missing: `aria-invalid`, `aria-describedby`, and a polite live region.
