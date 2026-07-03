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
- Tailwind v4 + shadcn/ui, Tiptap, TanStack Table, Resend + react-email

## Development

```bash
pnpm install
cp .env.example .env        # fill values (local Postgres works out of the box)
createdb lms_web_dev        # if using local Postgres
pnpm db:migrate             # apply migrations
pnpm db:seed                # plans, categories, config, badges, demo data
pnpm dev
```

Quality gates: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`

## Architecture notes

- **Money**: all amounts are `BigInt` minor units (paise); percentages are basis points.
- **Fulfillment links are reverse-only**: `Enrollment.orderItemId`, `ProjectInstance.orderItemId`, etc. — a bundle order item fans out to N fulfillments.
- **Vendor boundaries**: no Fermion/Razorpay types outside `src/lib/fermion` / `src/lib/payments`.
- **Webhooks are idempotent**: every provider event lands in `WebhookEvent` (unique per provider+eventRef) before processing.
- **Schema is finalized** across pre- and post-MVP domains; future work is additive-only. See `prisma/schema/`.
