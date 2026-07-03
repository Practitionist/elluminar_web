import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { getActiveSubscriptionWithPlan } from "@/lib/commerce/entitlements";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { learnerEntitlementsSchema } from "@/lib/validation/entitlements";

import { SubscribeButton } from "./subscribe-button";

export const metadata = { title: "Pricing" };

function tierHighlights(code: string, ent: ReturnType<typeof learnerEntitlementsSchema.parse>) {
  const items: string[] = [];
  if (code === "FREE") {
    return [
      "Browse the full marketplace",
      "Buy any course or project à la carte",
      "Free preview lessons",
      "14-day refund window",
    ];
  }
  if (ent.libraryAccess) items.push("Full self-paced library");
  if (ent.cohortAccess === "REPLAY") items.push("Cohort replay access");
  if (ent.cohortAccess === "INCLUDED") items.push("Live cohorts included");
  if (ent.cohortAccess === "PRIORITY") items.push("Live cohorts included, priority seats");
  if (ent.sprintCreditsPerMonth > 0)
    items.push(`${ent.sprintCreditsPerMonth} Sprint project credit/mo (as tiers launch)`);
  if (ent.capstoneDiscountBps > 0)
    items.push(`${ent.capstoneDiscountBps / 100}% off Capstone projects`);
  if (ent.alaCarteDiscountBps > 0)
    items.push(`${ent.alaCarteDiscountBps / 100}% off à la carte`);
  if (ent.priorityMentorMatching) items.push("Priority mentor matching");
  if (ent.hiringVisibility) items.push("Visible to hiring partners (opt-in)");
  if (ent.placementSupport) items.push("Placement support intake");
  if (ent.portfolioTier === "VERIFIED") items.push("Verified proof-of-work portfolio");
  if (ent.aiDailyCredits > 0) items.push(`${ent.aiDailyCredits} AI credits/day`);
  return items;
}

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

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Membership for how far you want to go
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
          Every tier keeps à la carte open — memberships add breadth and guided
          support, they never gate a single purchase.
        </p>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const monthly = plan.prices.find((p) => p.interval === "MONTHLY");
          const annual = plan.prices.find((p) => p.interval === "ANNUAL");
          const ent = learnerEntitlementsSchema.parse(plan.entitlements ?? {});
          const isCurrent = currentSub?.plan.code === plan.code;
          const highlighted = plan.code === "MENTOR";

          return (
            <Card key={plan.id} className={highlighted ? "border-primary shadow-md" : ""}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{plan.name}</CardTitle>
                  {highlighted && <Badge>Popular</Badge>}
                  {isCurrent && <Badge variant="secondary">Current</Badge>}
                </div>
                <CardDescription>{plan.tagline}</CardDescription>
                <div className="pt-2">
                  {plan.code === "FREE" ? (
                    <span className="text-3xl font-semibold">₹0</span>
                  ) : monthly ? (
                    <>
                      <span className="text-3xl font-semibold">
                        {formatMoney(monthly.amountMinor)}
                      </span>
                      <span className="text-sm text-muted-foreground">/month</span>
                      {annual && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          or {formatMoney(annual.amountMinor)}/year
                        </p>
                      )}
                    </>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="flex h-full flex-col justify-between gap-4">
                <ul className="space-y-1.5 text-sm">
                  {tierHighlights(plan.code, ent).map((h) => (
                    <li key={h}>✓ {h}</li>
                  ))}
                </ul>
                <SubscribeButton
                  planCode={plan.code}
                  planName={plan.name}
                  signedIn={Boolean(session)}
                  isCurrent={isCurrent}
                  hasAnnual={Boolean(annual)}
                  disabled={Boolean(currentSub) && !isCurrent}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
      <p className="mt-8 text-center text-xs text-muted-foreground">
        Prices are tax-inclusive. Cancel anytime — access runs to the end of the
        paid period. Plan changes apply at the next renewal.
      </p>
    </div>
  );
}
