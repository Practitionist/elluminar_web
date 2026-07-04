import { GradientThumb, Pill, SectionEyebrow, SectionHeading } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import { getActiveSubscriptionWithPlan } from "@/lib/commerce/entitlements";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { learnerEntitlementsSchema } from "@/lib/validation/entitlements";
import Link from "next/link";

import { PricingPlans, type PricingPlanData } from "./pricing-plans";

export const metadata = { title: "Pricing" };

function tierHighlights(
  code: string,
  ent: ReturnType<typeof learnerEntitlementsSchema.parse>,
) {
  if (code === "FREE") {
    return [
      "Browse the full marketplace",
      "Buy any course or project à la carte",
      "Free preview lessons",
      "14-day refund window",
    ];
  }
  const items: string[] = [];
  if (ent.libraryAccess) items.push("Full self-paced library");
  if (ent.cohortAccess === "REPLAY") items.push("Cohort replay access");
  if (ent.cohortAccess === "INCLUDED") items.push("Live cohorts included");
  if (ent.cohortAccess === "PRIORITY")
    items.push("Live cohorts included, priority seats");
  if (ent.sprintCreditsPerMonth > 0)
    items.push(`${ent.sprintCreditsPerMonth} Sprint project credit/mo`);
  if (ent.capstoneDiscountBps > 0)
    items.push(`${ent.capstoneDiscountBps / 100}% off Capstone projects`);
  if (ent.alaCarteDiscountBps > 0)
    items.push(`${ent.alaCarteDiscountBps / 100}% off à la carte`);
  if (ent.priorityMentorMatching) items.push("Priority mentor matching");
  if (ent.hiringVisibility) items.push("Visible to hiring partners (opt-in)");
  if (ent.placementSupport) items.push("Placement support intake");
  if (ent.portfolioTier === "VERIFIED")
    items.push("Verified proof-of-work portfolio");
  if (ent.aiDailyCredits > 0) items.push(`${ent.aiDailyCredits} AI credits/day`);
  return items;
}

// À la carte + AI packs are illustrative marketing — swap for real SKUs as flows land.
const ALACARTE = [
  {
    badge: "Single course",
    title: "Buy one course",
    desc: "Lifetime access to a single course when you don't want a subscription.",
    price: "₹1,499",
    compare: "₹2,999",
    note: "one-time · GST incl · EMI from ₹499/mo",
    features: [
      "Lifetime access · all lessons & labs",
      "Course completion certificate",
      "AI tutor credits included",
    ],
    cta: "Browse courses",
    href: "/courses",
    dark: false,
    featured: false,
  },
  {
    badge: "Capstone · verifiable credential",
    title: "Mentor-reviewed project",
    desc: "The full loop: real brief, senior reviews, live defense, and a credential the world can verify.",
    price: "₹5,999",
    compare: "₹9,999",
    note: "or free — 1/quarter on the Career plan",
    features: [
      "3 line-by-line mentor reviews (48h SLA)",
      "45-min recorded live defense",
      "Verifiable credential + public rubric",
      "Free resubmissions — best attempt counts",
    ],
    cta: "Browse projects",
    href: "/projects",
    dark: false,
    featured: true,
  },
  {
    badge: "Career path · best value",
    title: "Complete a full path",
    desc: "A course-to-credential bundle: everything for one role, one price, one outcome.",
    price: "₹7,999",
    compare: "₹10,497",
    note: "course + 2 reviewed projects",
    features: [
      "Backend course (lifetime)",
      "2 mentor-reviewed credentials",
      "Sequenced, job-ready order",
    ],
    cta: "See paths",
    href: "/projects",
    dark: true,
    featured: false,
  },
];

const AI_PACKS = [
  { credits: "+500", price: "₹99", tag: null as string | null },
  { credits: "+1,500", price: "₹249", tag: "POPULAR" },
  { credits: "+5,000", price: "₹699", tag: "BEST VALUE" },
];

const PRICING_FAQ = [
  {
    q: "Do I need a subscription to earn a credential?",
    a: "No. Projects are bought per-outcome and include everything — reviews, defense, credential. Career subscribers get one free each quarter.",
  },
  {
    q: "What's your refund policy?",
    a: "14 days on courses. Projects are refundable until your mentor kickoff. Subscriptions cancel anytime — it's all in writing at checkout.",
  },
  {
    q: "Can I pay with UPI or EMI?",
    a: "Yes — UPI, all major cards, netbanking, and no-cost EMI. Teams can pay by PO with GST invoicing.",
  },
  {
    q: "Do credentials ever expire?",
    a: "Never. They stay publicly verifiable even if you cancel. Revocation only happens for confirmed integrity violations.",
  },
];

export default async function PricingPage() {
  const session = await getSession();
  const [plans, currentSub] = await Promise.all([
    db.subscriptionPlan.findMany({
      where: { audience: "LEARNER", active: true },
      orderBy: { sort: "asc" },
      include: {
        prices: { where: { currency: "INR", region: null, active: true } },
      },
    }),
    session ? getActiveSubscriptionWithPlan(session.user.id) : null,
  ]);

  const planData: PricingPlanData[] = plans.map((plan) => {
    const monthly = plan.prices.find((p) => p.interval === "MONTHLY");
    const annual = plan.prices.find((p) => p.interval === "ANNUAL");
    const ent = learnerEntitlementsSchema.parse(plan.entitlements ?? {});
    return {
      code: plan.code,
      name: plan.name,
      tagline: plan.tagline,
      monthly: monthly ? formatMoney(monthly.amountMinor) : null,
      annualTotal: annual ? formatMoney(annual.amountMinor) : null,
      annualPerMonth: annual ? formatMoney(annual.amountMinor / 12n) : null,
      highlights: tierHighlights(plan.code, ent),
      isCurrent: currentSub?.plan.code === plan.code,
      hasAnnual: Boolean(annual),
      disabled: Boolean(currentSub) && currentSub?.plan.code !== plan.code,
      popular: plan.code === "MENTOR",
      dark: plan.code === "CAREER",
    };
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-14">
      <div className="mx-auto flex max-w-2xl flex-col items-center space-y-4 text-center">
        <SectionEyebrow>Pricing</SectionEyebrow>
        <SectionHeading as="h1">
          Pay for the <span className="text-primary italic">proof</span>, not the
          promise
        </SectionHeading>
        <p className="text-muted-foreground">
          A subscription for the learning. Pay-as-you-go for the projects and
          credentials that get verified. No lock-in, refunds in writing.
        </p>
      </div>

      <PricingPlans plans={planData} signedIn={Boolean(session)} />

      <p className="mt-6 text-center text-xs font-semibold text-muted-foreground">
        All prices inclusive of 18% GST · cancel anytime — access runs to the end
        of the paid period.
      </p>

      {/* À la carte */}
      <div className="mt-20">
        <div className="mx-auto max-w-2xl text-center">
          <div className="flex justify-center">
            <SectionEyebrow tone="distinction">Pay as you go</SectionEyebrow>
          </div>
          <SectionHeading className="mt-4">
            Projects &amp; credentials, priced per outcome
          </SectionHeading>
          <p className="mt-3 text-muted-foreground">
            A subscription covers the learning. Mentor-reviewed projects — the
            ones that end in a verifiable credential — are bought when you&apos;re
            ready.
          </p>
        </div>

        <div className="mt-10 grid items-stretch gap-5 lg:grid-cols-3">
          {ALACARTE.map((item) => (
            <div
              key={item.title}
              className={cnCard(item.dark, item.featured)}
            >
              <GradientThumb
                keyer={item.title}
                variant={item.dark ? "dark" : "light"}
                className="h-28"
                topLeft={
                  <span className="rounded-full bg-foreground/70 px-2.5 py-1 text-[11px] font-bold text-background">
                    {item.badge}
                  </span>
                }
              />
              <div className="flex flex-1 flex-col p-6">
                <div
                  className={
                    item.dark ? "text-lg font-extrabold text-ink-foreground" : "text-lg font-extrabold"
                  }
                >
                  {item.title}
                </div>
                <p
                  className={
                    item.dark
                      ? "mt-1.5 text-sm text-ink-muted"
                      : "mt-1.5 text-sm text-muted-foreground"
                  }
                >
                  {item.desc}
                </p>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold tracking-tight">
                    {item.price}
                  </span>
                  <s
                    className={
                      item.dark
                        ? "text-sm font-semibold text-ink-muted"
                        : "text-sm font-semibold text-muted-foreground"
                    }
                  >
                    {item.compare}
                  </s>
                </div>
                <div
                  className={
                    item.dark
                      ? "mt-1 text-xs font-semibold text-emerald-400"
                      : "mt-1 text-xs font-semibold text-primary"
                  }
                >
                  {item.note}
                </div>
                <ul
                  className={
                    item.dark
                      ? "mt-4 space-y-2 text-sm text-ink-foreground/85"
                      : "mt-4 space-y-2 text-sm text-muted-foreground"
                  }
                >
                  {item.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span
                        className={
                          item.dark ? "text-emerald-400" : "text-success"
                        }
                      >
                        ✓
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  render={<Link href={item.href} />}
                  className={
                    item.dark || item.featured
                      ? "mt-5 w-full rounded-full font-bold"
                      : "mt-5 w-full rounded-full bg-transparent font-bold text-foreground ring-1 ring-border ring-inset hover:bg-muted"
                  }
                >
                  {item.cta}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI credit packs */}
      <div className="mt-16 rounded-3xl border border-border bg-card p-8">
        <div className="grid items-center gap-8 md:grid-cols-[0.9fr_2fr]">
          <div>
            <Pill tone="distinction">◆ Add-on</Pill>
            <h3 className="mt-3 text-xl font-extrabold tracking-tight">
              Top up AI tutor credits
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Every plan includes a monthly allowance. Need more? Buy packs
              anytime — they roll over 30 days.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {AI_PACKS.map((pack) => (
              <div
                key={pack.credits}
                className="relative rounded-2xl border border-border bg-background p-5 text-center"
              >
                {pack.tag ? (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-extrabold whitespace-nowrap text-primary-foreground">
                    {pack.tag}
                  </span>
                ) : null}
                <div className="text-2xl font-extrabold">{pack.credits}</div>
                <div className="mt-0.5 text-xs font-bold text-muted-foreground">
                  credits
                </div>
                <div className="mt-3 text-lg font-extrabold text-primary">
                  {pack.price}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pricing FAQ */}
      <div className="mt-16">
        <SectionHeading className="text-center">
          Questions, answered
        </SectionHeading>
        <div className="mx-auto mt-8 grid max-w-4xl gap-3 md:grid-cols-2">
          {PRICING_FAQ.map((f) => (
            <div
              key={f.q}
              className="rounded-2xl border border-border bg-card p-5"
            >
              <div className="text-sm font-extrabold">{f.q}</div>
              <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function cnCard(dark: boolean, featured: boolean) {
  const base =
    "flex flex-col overflow-hidden rounded-3xl transition-all duration-300 hover:-translate-y-1";
  if (dark) return `${base} bg-ink text-ink-foreground`;
  if (featured)
    return `${base} border-2 border-primary/30 bg-card shadow-xl shadow-primary/10`;
  return `${base} border border-border bg-card`;
}
