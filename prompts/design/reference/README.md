# Mandated design reference (from `familiarise_web`)

These four files are verbatim snapshots from the owner's other production app,
**familiarise_web** (an expert-consultation marketplace). They are the
**user-mandated starting point** for three things in lms-web — the design
scheme, the landing hero banner, and the pricing section — so the design
session doesn't have to invent a visual language from scratch and doesn't need
access to the other repository.

| File | What it is | What to take |
|---|---|---|
| `globals.css` | The full design scheme: monochrome silver/zinc HSL token set (light + near-black dark mode), named mono palette (`silver / charcoal / smoke / ash / steel / graphite`), fluid type scale (`--fs-xs`…`--fs-5xl` via `clamp()`), 0.75rem radius, glassmorphism recipes, silver gradient text, mesh/metallic gradients, dot/grid patterns, blob/float/shimmer/marquee/reveal animations, feature-card and elevated-card hover treatments | The **visual language**: palette, dark-mode philosophy (true near-black, silver highlights), fluid type, elevation, texture and motion vocabulary. Ignore the app-specific tail (Stream video/chat overrides, Novu overrides, maintenance-banner plumbing). |
| `tailwind.config.ts` | Tailwind **v3** theme extension: Sora as `sans`/`display`, `text-fluid-*` sizes with per-step line-height/tracking, `shadow-elevation-1/2/3` (dark-mode aware via `--shadow-color`), silver/metallic `backgroundImage` presets, radius scale | The token *semantics*. lms-web is Tailwind **v4** — port these to `@theme` CSS variables; do not copy the config file format. |
| `HeroSection.tsx` | The landing hero: near-black section, animated zinc gradient orbs + grid-pattern overlay + spotlight, glass badge pill, fluid-5xl headline with silver-shimmer span and zinc-toned second line, white-on-black primary CTA + outline secondary (icon micro-interactions), animated stat counters above a hairline, staggered entrance reveals, bottom gradient fade | The **composition and mood**. Rewrite the copy, stats, and CTAs for lms-web's actual promise (proof-of-work technical education); re-evaluate framer-motion vs CSS-only for an RSC-heavy app. |
| `pricing-page.tsx` | The pricing section: centered fluid display title, stacked `max-w-4xl` elevation-1 cards (how-pricing-works with ✓-list panel, commission callout, icon+badge service-category rows, payment-methods badges with separators, FAQ accordion, closing CTA card on secondary background) | The **page rhythm and card grammar**. lms-web has a real tier ladder plus à-la-carte and enterprise motions — adapt the pattern to genuine plan-comparison content (tier cards/table) while keeping this page's calm, document-like clarity, GST-inclusive INR framing, and FAQ + CTA closing sequence. |

Ground rules when adapting:

- The scheme is the **baseline, not a ceiling** — extend it where lms-web needs
  things familiarise never had (data-viz for org reporting, co-brand seams,
  verdict/credential moments), but stay inside the monochrome discipline unless
  gate 2 of the brief explicitly argues for an accent.
- Contrast-check every ported value against WCAG 2.2 AA in both modes; fix at
  the token, never per-screen.
- Semantic status colors (`success/warning/info/error`) exist in the reference
  and stay colored — money and state must never be ambiguous in a mono UI.
