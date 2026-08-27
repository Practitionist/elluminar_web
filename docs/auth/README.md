# Authentication & authorization

How identity works in this codebase, and — more usefully — where the sharp
edges are. Start here before changing anything under `src/lib/auth`.

- [ADR 001 — form architecture](./adr-001-form-architecture.md)
- [ADR 002 — enterprise SSO](./adr-002-enterprise-sso.md)
- [ADR 003 — SCIM (design only)](./adr-003-scim-design.md)
- [SSO onboarding runbook](./runbook-sso.md)
- [Manual verification checklist](./verification-checklist.md)

---

## The stack

**Better Auth 1.6.23** with the `organization`, `admin`, `twoFactor` and
`@better-auth/sso` plugins, on Prisma 7 / Postgres. Configured in one place:
`src/lib/auth/index.ts`.

Everything auth-related is mounted under a single catch-all route handler at
`src/app/api/auth/[...all]/route.ts`. We add **no auth API routes of our own** —
including for SAML, whose ACS, SP-metadata and Single-Logout endpoints Better
Auth already serves under that same handler.

> The installed version is one minor behind current (1.7.x). Where the docs site
> and the installed `.d.mts` disagree, **the installed types win** — several
> option names differ (e.g. `sendChangeEmailConfirmation` here vs
> `sendChangeEmailVerification` in the 1.7 docs).

## Two role systems, deliberately separate

| | Platform roles | Organization roles |
|---|---|---|
| Stored on | `User.role` (admin plugin) | `Member.role` (organization plugin) |
| Values | `user` · `support` · `admin` | `owner` · `admin` · `instructor` · `member` |
| Defined in | `src/lib/auth/permissions.ts` | `src/lib/auth/permissions.ts` (`ac`, `orgRoles`) |
| Checked by | `requirePlatformRole`, `adminActionClient` | `requireTenantMember`, `tenantActionClient` |

**`Member.role` is a comma-separated string.** A bare `role === "instructor"`
silently denies someone whose membership reads `"instructor,member"`. Always go
through `hasOrgRole()` / `parseOrgRoles()` in `src/lib/auth/roles.ts`; there is
a regression test in `tests/unit/org-roles.test.ts`, including the
substring-attack case (`hasOrgRole("administrator", ["admin"]) === false`).

`canGrade()` exists for a specific reason: enterprise and university learners
hold a plain `member` row in the *buying* organization, so `member` must never
imply the ability to grade.

### Known gaps, stated rather than hidden

- **`support` grants nothing.** It is in `PLATFORM_ROLES` but no code path
  checks for it; only `admin` is ever tested.
- **`hasOrgPermission()` is unused.** It is the only bridge to Better Auth's
  fine-grained `ac` engine, so the `statement`/`ac` permission map in
  `permissions.ts` is defined but not enforced at runtime — all real checks are
  coarse role-list matching. Wiring it up is a separate piece of work.

## The guard ladder

Four layers, each doing a different job. None of them is sufficient alone.

1. **`src/proxy.ts`** (Next 16's renamed middleware). Checks only that a session
   *cookie exists* — `getSessionCookie()` does no validation and no DB read. It
   is a routing optimisation, never an authorization decision.
2. **Layouts and pages** call `requireUser` / `requirePlatformRole` /
   `requireTenantMember` from `src/lib/auth/session.ts`. This is where real
   authorization happens for reads.
3. **Server actions** re-authorize independently via the client hierarchy in
   `src/lib/safe-action.ts`. A page-level check does **not** extend to the
   actions defined on that page: a Server Action is a public POST endpoint
   reachable without ever rendering the page.
4. **The data access layer** (`src/lib/account/queries.ts`,
   `src/lib/onboarding/state.ts`) is `server-only` and returns DTOs, never raw
   Prisma rows.

## Two deliberate escape hatches

Both widen access. Both are intentional. Neither is subtle enough to forget.

**`DEV_DISABLE_AUTH=true`** (non-production only, `src/lib/auth/session.ts` and
`src/proxy.ts`) fabricates a session from the oldest seeded user with `role`
forced to `"admin"`. It bypasses the proxy and every `requireX` helper.

It does *not* mint a real Better Auth cookie, so anything reading Better Auth's
own session store still sees an anonymous request — which is why
`getAccountSessions()` degrades to an empty list under the bypass instead of
500ing. **Always unset it when testing an auth change**, or you will be testing
nothing.

Note that neither `DEV_DISABLE_AUTH` nor `DEV_AUTH_EMAIL` is declared in
`src/env.ts` or `.env.example` — they are raw `process.env` reads.

**`showAllSurfaces()`** (`src/lib/deploy-context.ts`) returns true on Netlify
preview and branch deploys, letting any signed-in user open `/admin` and every
tenant dashboard. It widens *authorization*, never authentication, and is
written as an allowlist so an unknown `CONTEXT` falls through to strict.

## Session and rate-limit storage

Upstash Redis is configured as `secondaryStorage` **for rate limiting only**.
Sessions and verification values are pinned to Postgres
(`storeSessionInDatabase: true`, `verification.storeInDatabase: true`) so a
Redis eviction or outage can never log everyone out or invalidate a
password-reset token mid-flight.

Per-endpoint limits are in the `rateLimit.customRules` block: 5/min on
`/sign-in/email`, 3/min on `/sign-up/email`, 3 per 5 min on
`/request-password-reset`, 5/min on `/two-factor/verify-totp`.

## Email

One mailer, `src/lib/email/index.ts`, on Resend, with a console fallback when
`RESEND_API_KEY` is absent so auth flows stay testable locally.

Two entry points, and the difference matters:

- **`sendEmail`** throws on failure. Use it where delivery *is* the outcome the
  caller is waiting on — an explicit "resend" the user just clicked.
- **`sendAuthEmail`** catches, reports to Sentry, and returns `null`. Use it in
  Better Auth's lifecycle hooks. Better Auth awaits those hooks inside the
  request, so a throwing mailer previously took down sign-up entirely and rolled
  the account back over an email we could have retried.

Templates live in `src/lib/email/templates/` and render to HTML *and* plain
text. Email clients support essentially none of the app's stack, so the palette
there is a hand-converted sRGB approximation of the brand tokens rather than a
reference to them — OKLCH, CSS variables and `prefers-color-scheme` are all
unreliable in mail.

## Onboarding

Two different flows that are easy to confuse:

| Route | Who | What it does |
|---|---|---|
| `/welcome` | Every new learner | Three-step first-run wizard; stamps `User.onboardedAt` |
| `/onboarding` | Creators, companies, universities | Organization application |

`/welcome` holds no client-side draft state. Each step persists on submit and
the step to show is derived server-side from what is stored, so a refresh or a
different device resumes in place. Progress rides in `PortfolioProfile.about`
(an existing `Json` column) because **the Prisma schema is frozen** — CI's
`schema-freeze` job fails any PR touching `prisma/**` without a
`schema-approved` label.

Skipping stamps `onboardedAt` exactly like finishing. Leaving it null would
re-ask on every visit, and every question is also available under `/account`.

## Testing

Unit tests only — **there is no Playwright in this repo**, and it should not be
reintroduced: `playwright test` spawns its own Next dev server, which is too
RAM-heavy on the primary dev machine. UI is verified through the
chrome-devtools MCP server against an already-running browser, following
[the manual checklist](./verification-checklist.md).

```bash
pnpm typecheck && pnpm lint && pnpm test
```

`pnpm build` runs in CI on every push; don't run it locally.

Vitest is `environment: "node"` and includes `.ts` and `.tsx`. Pure logic is
extracted specifically so it can be tested without a database — that is why
`src/lib/onboarding/steps.ts` exists separately from the `server-only`
`state.ts`, and why `fieldErrors`/`formError` live in `src/lib/form-errors.ts`
rather than in `safe-action.ts`.

> That last one is not just tidiness: `safe-action.ts` imports
> `lib/auth/session`, which is `server-only`. A client component importing a
> helper from there pulls the Prisma client into the browser bundle. `tsc` does
> not catch it — it surfaces as a module-not-found at request time.
