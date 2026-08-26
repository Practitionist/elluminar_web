# Vendor Strategy: Fermion Integration & Build-vs-Buy

> Condensed from the full analysis. Sources: fermion.app pricing/docs,
> `docs/Product_Requirements_System_Design_Spec.docx` §4/§8/§9, GitHub issues #52/#53/#29/#39.

## ⚠️ Status update — Aug 2026: Fermion acquired by Testpress

- **Fermion was acquired by Testpress** (Chennai) on 2026-05-22; founder Mehul Mohan exited ("clean exit", relocated to Dubai); **codedamn itself sunsets Dec 31 2026**.
- Official line for customers: "nothing changes — same product, same login". Testpress plans to fold Fermion live-class infra into Testpress/TPStreams; sandbox kept ("more on that soon").
- **Infra liveness verified 2026-08-26**: `fermion.app` ✅ · `docs.fermion.app` ✅ · `backend.codedamn.com/api/public` responds with valid Fermion API envelopes ✅. New-school self-serve signup appears gated during migration → outreach letter drafted (temp folder) to support@testpress.in / support@codedamn.com.
- **Decision posture:** probe Testpress provisioning; in parallel evaluate narrow-specialist stack below. The vendor boundary (`src/lib/fermion/*`) confines any swap to ~5 files.

### Narrow-specialist landscape (researched Aug 2026)

| Capability | Top pick (beta budget) | Entry price | Runner-up |
| --- | --- | --- | --- |
| Video + DRM (Widevine/FairPlay) | **VdoCipher** Starter — $149/**yr**, 1TB annual bandwidth, watermarking incl. | cheapest legit DRM entry | Gumlet Growth $19 + DRM add-on $99/mo (monthly billing, analytics); Bunny Stream PAYG ≈$110–150/mo all-in; Kinescope €10/mo w/ DRM included |
| Live classes (host→cohort) | **Stream Video** livestream call type — $100 free credit/mo covers modeled beta usage (~$0–110/mo typical; chat cliff at 1K MAU → $399/mo) | verify Mumbai SFU placement w/ sales | LiveKit Cloud ($50/mo Ship tier, OSS escape hatch); 100ms ($0.0012/viewer-min streaming); Agora (whiteboard included) |
| Community chat | **Stream Chat** — free ≤1,000 MAU / 100 concurrent | $0 at beta scale | In-house discussions (already built) |
| Code execution / judge | **Judge0** self-host (OSS) or hosted; Piston public API free | ~VPS cost | Sphere Engine (commercial); Fermion labs if Testpress deal lands |
| Quizzes / assignments / grading / credentials / commerce / enterprise | **In-house — already built and ours** | ₹0 | No vendor needed or useful here |

Notes: Cloudflare Stream has **no Widevine/FairPlay** (signed URLs only). Mux DRM = $100/mo base + per-play. White-label OTT suites (Muvi $399+, Enveu $699+, Ventuno $299+) are over budget. AWS DIY ≈ $4.6k/mo at real scale — not viable. TPStreams Start **$150/mo** bundles multi-DRM + forensic watermarking + live + India support — effectively the closest single-vendor replacement if the Testpress relationship works out. Euron Systems (₹3,999–24,999/mo, launched 2026): broad suite but no evident coding sandbox, unproven durability. Teachyst: micro storefront LMS — not a competitor for this stack.

### Component coverage matrix — who solves what

| Capability | In-house (today) | Testpress/Fermion | Euron | Narrow stack |
| --- | --- | --- | --- | --- |
| Courses, quizzes, assignments | ✅ built | ✅ (unused) | ✅ | ✅ keep ours |
| Projects/mentor review engine | ✅ built (differentiator) | ❌ | ❌ | ❌ nowhere else |
| DRM video | EXTERNAL URLs only | ✅ | ✅ Enterprise tier | VdoCipher/Gumlet/Bunny |
| Live interactive classes | broken (#53 pending vendor) | ✅ roadmap | ✅ native | Stream/LiveKit/100ms |
| Coding sandbox + judge | stubbed behind boundary | ✅ kept | ❌ not evident | Judge0/Piston/Sphere |
| Chat/community | basic (discussions+XP) | ✅ community feature | ✅ CRM-ish | Stream Chat free tier |
| Payments/commerce/enterprise | ✅ Razorpay + licensing | n/a | partial (their rails) | keep ours |

**Bottom line:** no single vendor replaces the whole stack; the differentiated layers exist only in-house; commodity layers have 2–3 credible swappable options at every price point.

---

## What Fermion is

Fermion (by the codedamn team) is a whitelabeled, API-first **infrastructure layer**
for ed-tech — "AI-ready cloud for ed-tech". It bundles four capabilities that are
normally four vendor relationships:

| Pillar | Notes |
| --- | --- |
| Managed LMS | courses, cohorts, assignments, auto-grading, certificates, 0% transaction fee |
| Live class infra | Zoom replacement, up to 10k concurrent, recordings + AI captions |
| Coding sandboxes / DSA judge | Linux VMs, interactive + IO labs, 5000+ prebuilt problems |
| Video security | Widevine + FairPlay DRM, AES-128, adaptive bitrate, watermarking |

**Integration mechanics** (verified against official docs, implemented in
`src/lib/fermion/*`): API-key header auth, `{data:[{data}]}` request envelope,
60 req/min limit, webhooks signed via the `X-Fermion-Webhook-Secret` header,
JWT-signed iframe embeds for DRM video (`/embed/recorded-video`) and labs
(`/embed/lab`, `/embed/io-coding-lab`) signed with the API key.

## Strategic verdict (SRS §4.3): rent the commodity layer, own the differentiated layer

Pilot on Fermion for commodity infra (video/DRM, live-class rendering, code
execution) for 6–12 months to reach market fast — but keep every integration
behind our service boundary. Our data model, mentor/project workflow, multi-tenant
commerce, and enterprise packaging are the actual IP and must never live inside a
vendor's product.

### Build in-house (owned, already ours)

- Mentor-guided project engine (catalog → milestones → rubric review → defense → credential)
- Quiz engine, assignments, drip gating, progress/completion logic
- Multi-tenant storefronts, universal cart, subscriptions, refunds ledger
- Enterprise licensing / rostering / SSO / reporting
- Credentials + public verification + proof-of-work portfolio

### Buy narrow (swap targets if Fermion disappoints)

| Capability | Alternatives |
| --- | --- |
| Video hosting + DRM | VdoCipher, Mux, Cloudflare Stream |
| Live classes | LiveKit (self-host OSS), 100ms, Agora, Daily |
| Code judge / sandboxes | Judge0 (self-host OSS), Sphere Engine |
| Plagiarism / AI detection (#20) | Copyleaks-class specialists |
| Email/SMS/WhatsApp (#10) | Resend (live), Novu |

Every Fermion touchpoint keeps an escape hatch: `VideoProvider FERMION|EXTERNAL`,
`LiveSession.joinUrl`, external-link lessons. That contract is the swap-out insurance.

## Where we use Fermion (post-#52)

| Surface | Integration point | State |
| --- | --- | --- |
| DRM video lessons | presigned upload → transcode → webhook READY → JWT private embed (`@fermion-app/sdk`) | ✅ this PR |
| Course trailers | same pipeline; render pending | backlog |
| CODE_LAB lessons | JWT lab embed + SandboxSession metering + lab-run-tests webhook storage | ✅ this PR (results stored only; grading hookup deferred) |
| DSA judge API | `requestDsaRun`/`getDsaRunResult` wired into grading | deferred |
| Live classes | provisioning done; join/embed fix tracked in #53 | separate PR |
| Captions/accessibility | caption-ready webhooks | not started |
| Mobile app | $199 branded app vs Expo build | decision issue #29 |

## Pricing model (what it costs us)

Usage-based; Pro ≈ ₹4,999/mo. Included (Basic): 100 GB bandwidth/mo ($0.04/GB over),
10 GB storage, 5k DSA runs ($1/3k over), 100 sandbox hours ($0.045/hr), 50 concurrent
sandboxes, 500 emails, 0% transaction fee, unlimited users. DRM playback ≈ $4/1k.
Branded mobile apps: $199 one-time setup. **Beta-scale estimate: < $99/mo total.**

## Product pricing strategy (SRS §8)

- Value-named learner tiers: Free / Learn / Mentor / Career / Enterprise — sell the
  outcome (human-guided support + career proof), not feature volume.
- India-first rails: Razorpay + UPI, GST invoice engine (Tier-0), EMI partner later (#9),
  PPP pricing (#21), Dodo as MoR for international (#1).
- Monetization lever we own: `SandboxSession` metering enables charging creators
  margin on sandbox/lab usage.
- Private beta before public launch (epic #42); growth backlog order = issue numbers #1–#29.

## Known risks & mitigations

- **Vendor scale**: small team, no published SLA → reconciliation job self-heals missed
  webhooks; fail-closed intake; EXTERNAL fallbacks everywhere; possible bake-off vs Euron Systems.
- **Rate limits**: 60 req/min on all endpoints → per-launch calls only, no polling loops.
- **Identity drift**: we pass our user id at creation so webhooks echo `apiUserId`;
  email changes on Fermion side must sync back (open follow-up).
- **DRM constraint**: DRM video can ONLY play via Fermion's iframe player (no manual
  M3U8); resume-position is unsupported there by design of the SDK.
