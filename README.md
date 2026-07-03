# lms-web

Unified learning platform & mentor-guided project marketplace — courses (recorded + live), mentor-reviewed projects (Sprint/Capstone/Flagship), multi-tenant creator storefronts, and enterprise/university programs, sold à la carte through one cart.

Strategy docs: [`docs/`](docs/) (PRD + competitive teardown). Post-MVP roadmap lives in [GitHub issues](https://github.com/teetangh/lms_web/issues).

## Stack

- **Next.js** (App Router, RSC, Server Actions via next-safe-action) on **Netlify**
- **Supabase** Postgres (Supavisor pooling) + Storage, **Prisma 7** (multi-file schema, `@prisma/adapter-pg`)
- **BetterAuth** — email/password, Google, organizations (+teams, dynamic roles), admin, SSO (OIDC/SAML), 2FA
- **Zod 4** everywhere (env, actions, forms, entitlements)
- **Razorpay** (orders + subscriptions + refunds) behind a provider interface; Dodo Payments post-MVP
- **Fermion** (Basic plan) for video/DRM, live classes, and code labs — behind `src/lib/fermion` so it stays swappable
- **Sentry** (@sentry/nextjs) — error capture, structured logs, traces, session replay, cron check-ins
- Tailwind v4 + shadcn/ui, Tiptap, TanStack Table, Resend + react-email

## Development

This repo uses **pnpm only** (enforced via `packageManager`). `pnpm-workspace.yaml`
is pnpm's build-script allowlist (sharp/prisma/@sentry/cli postinstalls) — not an
npm artifact and not a monorepo marker.

```bash
pnpm install
cp .env.example .env        # fill values (local Postgres works out of the box)
createdb lms_web_dev        # if using local Postgres
pnpm db:migrate             # apply migrations
pnpm db:seed                # plans, categories, config, badges, demo data
pnpm dev
```

Quality gates: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`

## Environment variables

`.env.example` is the authoritative list. Groups (all optional except the first two —
missing providers degrade gracefully with clear messages):

| Group | Vars | Needed for |
|---|---|---|
| Database | `DATABASE_URL`, `DIRECT_URL` | everything (required) |
| Auth | `BETTER_AUTH_SECRET` (required), `NEXT_PUBLIC_APP_URL`, `GOOGLE_CLIENT_ID/SECRET` | sessions, Google sign-in |
| Payments (MVP) | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID` | checkout, subscriptions, refunds |
| Payments (post-MVP) | Dodo vars arrive with issue [#1](https://github.com/teetangh/lms_web/issues/1) | international MoR |
| Fermion | `FERMION_API_KEY`, `FERMION_WEBHOOK_SECRET` | DRM video, live classes, code labs |
| Email | `RESEND_API_KEY`, `EMAIL_FROM` | transactional email (console fallback in dev) |
| Storage | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | uploads, certificates |
| Observability | `NEXT_PUBLIC_SENTRY_DSN` (public), `SENTRY_AUTH_TOKEN` (secret, build-time source maps), `SENTRY_TRACES_SAMPLE_RATE` | Sentry |
| Ops | `CRON_SECRET` | scheduled maintenance endpoint |

## Architecture notes

- **Money**: all amounts are `BigInt` minor units (paise); percentages are basis points.
- **Fulfillment links are reverse-only**: `Enrollment.orderItemId`, `ProjectInstance.orderItemId`, etc. — a bundle order item fans out to N fulfillments.
- **Vendor boundaries**: no Fermion/Razorpay types outside `src/lib/fermion` / `src/lib/payments`.
- **Webhooks are idempotent**: every provider event lands in `WebhookEvent` (unique per provider+eventRef) before processing.
- **Schema is finalized** across pre- and post-MVP domains; future work is additive-only. See `prisma/schema/`.
