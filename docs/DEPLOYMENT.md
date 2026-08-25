# Deployment runbook

## 1. Supabase (database + storage)

1. Create a project at supabase.com → note the project ref + region.
2. Set env vars:
   - `DATABASE_URL` — Supavisor **transaction** pooler, port **6543** (runtime)
   - `DIRECT_URL` — **session** connection, port **5432** (Prisma CLI/migrations)
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
3. Apply schema + seed: `pnpm db:deploy && pnpm db:seed`
   - The finalization migration runs `CREATE EXTENSION IF NOT EXISTS vector` (pgvector, for the
     post-MVP AI tutor). Supabase ships pgvector — if the migration errors on a fresh project,
     enable it first (Dashboard → Database → Extensions, or SQL editor:
     `CREATE EXTENSION IF NOT EXISTS vector;`) and re-run `pnpm db:deploy`. Local dev needs
     Homebrew pgvector (`brew install pgvector` for PG16).
4. Create Storage buckets: `public-assets` (public), `uploads`, `submissions`, `certificates` (private).

## 2. Razorpay

1. Dashboard → API keys (test first): `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`.
2. Webhook → `https://<site>/api/webhooks/razorpay`, secret → `RAZORPAY_WEBHOOK_SECRET`.
   Events: `payment.captured`, `payment.failed`, `refund.processed`, `subscription.activated`,
   `subscription.charged`, `subscription.halted`, `subscription.paused`, `subscription.resumed`,
   `subscription.cancelled`, `subscription.completed`.
3. Subscriptions must be enabled on the account (Razorpay approval). Plan ids are
   auto-provisioned on first subscribe and stored in `SubscriptionPlan.providerRefs`.

## 3. Fermion (video/DRM, live, code labs — Basic plan)

1. Create an org at fermion.app, enable API access → `FERMION_API_KEY`.
2. Configure webhook → `https://<site>/api/webhooks/fermion`, secret → `FERMION_WEBHOOK_SECRET`.
3. Until the key is set, the app degrades gracefully: external video URLs play,
   labs show a placeholder, live sessions use external links.

## 4. Resend (email)

`RESEND_API_KEY` + verified sending domain → `EMAIL_FROM` (e.g. `lms-web <no-reply@yourdomain.com>`).
Without a key, emails log to the server console (dev-safe).

## 5. BetterAuth

- `BETTER_AUTH_SECRET` — `openssl rand -base64 32`
- `NEXT_PUBLIC_APP_URL` — canonical site URL
- Google OAuth (optional): `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`; redirect URI
  `https://<site>/api/auth/callback/google`.

## 6. Netlify

1. Import the GitHub repo (build auto-detects Next.js via the OpenNext adapter; `netlify.toml` sets Node 22).
2. Add ALL env vars above + `CRON_SECRET` (random string) in Site settings → Environment.
3. The `scheduled-maintenance` function runs `@daily` (netlify.toml) and hits
   `/api/cron/maintenance` with the secret.
4. Deploy previews work out of the box; production deploys on push to `main`.

## 7. First-run bootstrap

1. Sign up with your admin email, verify, then promote yourself:
   `update "user" set role='admin' where email='<you>';`
2. `/admin` → approve tenants, vet mentors, moderate the first courses/projects.
3. Toggle launch gates at `/admin/flags` (`career-tier` etc.).

## 8. Verification checklist

- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all green
- Golden path in Razorpay **test mode**: cart → checkout modal → test card →
  enrollment appears in `/learn`, ledger rows in `/studio/<slug>/earnings`,
  invoice number on `/billing`
- Refund path: request from `/learn/orders` → approve in `/admin/refunds` →
  status + credit note + clawback entries
- Subscription: subscribe to Learn (test UPI/card mandate) → library access;
  cancel → access holds until period end
- Webhook logs: Razorpay dashboard shows 2xx on `/api/webhooks/razorpay`

## Known MVP boundaries (tracked as GitHub issues)

- Payouts are manual (issue #14 automates via RazorpayX)
- Observability is console-level (issue #11 adds Sentry)
- Certificate PDFs: the `/verify` page is the credential at MVP; PDF rendering
  ships with portfolio work (issue #6)
- GST invoice PDFs + DPDP tooling: compliance pack (issue #24)
