import Link from "next/link";

import { Pill } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { poolBalanceMinor } from "@/lib/enterprise/credit-math";
import { formatMoney } from "@/lib/money";

import { RedeemButton } from "./redeem-button";

export const metadata = { title: "My organization benefits" };

export default async function LearnOrgPage() {
  const session = await requireUser("/learn/org");
  const now = new Date();

  // Orgs the learner belongs to, with their active licenses.
  const memberships = await db.member.findMany({
    where: { userId: session.user.id },
    include: {
      organization: {
        include: {
          tenant: {
            include: {
              orgLicenses: {
                where: { status: "ACTIVE", startsAt: { lte: now }, endsAt: { gte: now } },
                include: {
                  seatsAssigned: { where: { userId: session.user.id, status: "ACTIVATED" } },
                  consumptions: { select: { amountMinor: true, userId: true, courseId: true, projectId: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const orgs = memberships
    .map((m) => m.organization.tenant)
    .filter(
      (t): t is NonNullable<typeof t> =>
        !!t && (t.type === "ENTERPRISE" || t.type === "UNIVERSITY"),
    )
    .filter((t) => t.orgLicenses.length > 0);

  if (orgs.length === 0) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-border bg-card px-6 py-16 text-center">
          <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
            Organization benefits
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            When your company or university licenses elluminar, your included
            catalog and credit benefits appear here.
          </p>
        </div>
      </div>
    );
  }

  // Catalog data for redemption listings.
  const [courses, projects] = await Promise.all([
    db.course.findMany({
      where: { status: "PUBLISHED", visibility: "MARKETPLACE" },
      include: { prices: { where: { active: true, currency: "INR", region: null } } },
      orderBy: { enrollmentCount: "desc" },
      take: 100,
    }),
    db.project.findMany({
      where: { status: "PUBLISHED", visibility: "MARKETPLACE" },
      include: {
        prices: { where: { active: true, currency: "INR", region: null, mentorLevel: null } },
      },
      orderBy: { purchaseCount: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div className="space-y-10">
      <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
        Organization benefits
      </h1>

      {orgs.map((tenant) =>
        tenant.orgLicenses.map((license) => {
          if (license.kind === "CATALOG") {
            const hasSeat = license.seatsAssigned.length > 0;
            const scope = (license.catalogScope ?? {}) as { courseIds?: string[] };
            const covered = scope.courseIds?.length
              ? courses.filter((c) => scope.courseIds!.includes(c.id))
              : courses;
            return (
              <section key={license.id} className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-extrabold">
                    {tenant.displayName} — included catalog
                  </h2>
                  <Pill tone={hasSeat ? "success" : "neutral"}>
                    {hasSeat ? "your seat is active" : "no seat assigned"}
                  </Pill>
                </div>
                {hasSeat ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {covered.map((course) => (
                      <div key={course.id} className="rounded-2xl border border-border bg-card p-4">
                        <p className="line-clamp-2 text-sm font-extrabold">{course.title}</p>
                        <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                          Included with your seat
                        </p>
                        <Button
                          render={<Link href={`/learn/courses/${course.id}`} />}
                          size="sm"
                          className="mt-3 rounded-full"
                        >
                          Start learning
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Ask your admin for a seat on this license.
                  </p>
                )}
              </section>
            );
          }

          if (license.kind === "CREDIT_POOL") {
            const consumed = license.consumptions.reduce((s, c) => s + c.amountMinor, 0n);
            const balance = poolBalanceMinor(license.contractValueMinor ?? 0n, consumed);
            const myRedeemedCourseIds = new Set(
              license.consumptions
                .filter((c) => c.userId === session.user.id && c.courseId)
                .map((c) => c.courseId),
            );
            const myRedeemedProjectIds = new Set(
              license.consumptions
                .filter((c) => c.userId === session.user.id && c.projectId)
                .map((c) => c.projectId),
            );
            return (
              <section key={license.id} className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-extrabold">
                    {tenant.displayName} — credit pool
                  </h2>
                  <Pill tone="primary">{formatMoney(balance)} available</Pill>
                </div>
                <p className="text-sm text-muted-foreground">
                  Redeem any course or mentor-guided project — your organization
                  pays from its prepaid pool.
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {courses.slice(0, 12).map((course) => {
                    const price = course.prices[0];
                    if (!price) return null;
                    const redeemed = myRedeemedCourseIds.has(course.id);
                    const affordable = balance >= price.amountMinor;
                    return (
                      <div key={course.id} className="rounded-2xl border border-border bg-card p-4">
                        <p className="line-clamp-2 text-sm font-extrabold">{course.title}</p>
                        <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                          {formatMoney(price.amountMinor)}
                        </p>
                        <div className="mt-3">
                          {redeemed ? (
                            <Button
                              render={<Link href={`/learn/courses/${course.id}`} />}
                              size="sm"
                              variant="outline"
                              className="rounded-full"
                            >
                              Continue
                            </Button>
                          ) : (
                            <RedeemButton
                              licenseId={license.id}
                              itemType="COURSE"
                              courseId={course.id}
                              title={course.title}
                              priceLabel={formatMoney(price.amountMinor)}
                              disabled={!affordable}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {projects.slice(0, 6).map((project) => {
                    const price = project.prices[0];
                    if (!price) return null;
                    const redeemed = myRedeemedProjectIds.has(project.id);
                    const affordable = balance >= price.amountMinor;
                    return (
                      <div key={project.id} className="rounded-2xl border border-border bg-card p-4">
                        <div className="flex gap-1.5">
                          <Pill tone="distinction">{project.tier.toLowerCase()}</Pill>
                          <Pill tone="info">mentor-reviewed</Pill>
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm font-extrabold">{project.title}</p>
                        <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                          {formatMoney(price.amountMinor)}
                        </p>
                        <div className="mt-3">
                          {redeemed ? (
                            <Button
                              render={<Link href="/learn/projects" />}
                              size="sm"
                              variant="outline"
                              className="rounded-full"
                            >
                              Open workspace
                            </Button>
                          ) : (
                            <RedeemButton
                              licenseId={license.id}
                              itemType="PROJECT"
                              projectId={project.id}
                              title={project.title}
                              priceLabel={formatMoney(price.amountMinor)}
                              disabled={!affordable}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          }
          return null;
        }),
      )}
    </div>
  );
}
