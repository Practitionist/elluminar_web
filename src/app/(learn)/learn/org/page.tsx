import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Organization benefits</h1>
        <p className="mt-2 text-muted-foreground">
          When your company or university licenses lms-web, your included
          catalog and credit benefits appear here.
        </p>
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
      <h1 className="text-2xl font-semibold tracking-tight">Organization benefits</h1>

      {orgs.map((tenant) =>
        tenant.orgLicenses.map((license) => {
          if (license.kind === "CATALOG") {
            const hasSeat = license.seatsAssigned.length > 0;
            const scope = (license.catalogScope ?? {}) as { courseIds?: string[] };
            const covered = scope.courseIds?.length
              ? courses.filter((c) => scope.courseIds!.includes(c.id))
              : courses;
            return (
              <section key={license.id}>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">
                    {tenant.displayName} — included catalog
                  </h2>
                  <Badge variant={hasSeat ? "default" : "secondary"}>
                    {hasSeat ? "your seat is active" : "no seat assigned"}
                  </Badge>
                </div>
                {hasSeat ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {covered.map((course) => (
                      <Card key={course.id}>
                        <CardHeader className="pb-2">
                          <CardTitle className="line-clamp-2 text-sm">{course.title}</CardTitle>
                          <CardDescription>Included with your seat</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <Button
                            render={<Link href={`/learn/courses/${course.id}`} />}
                            size="sm"
                          >
                            Start learning
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
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
              <section key={license.id}>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">
                    {tenant.displayName} — credit pool
                  </h2>
                  <Badge>{formatMoney(balance)} available</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Redeem any course or mentor-guided project — your organization
                  pays from its prepaid pool.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {courses.slice(0, 12).map((course) => {
                    const price = course.prices[0];
                    if (!price) return null;
                    const redeemed = myRedeemedCourseIds.has(course.id);
                    const affordable = balance >= price.amountMinor;
                    return (
                      <Card key={course.id}>
                        <CardHeader className="pb-2">
                          <CardTitle className="line-clamp-2 text-sm">{course.title}</CardTitle>
                          <CardDescription>{formatMoney(price.amountMinor)}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          {redeemed ? (
                            <Button
                              render={<Link href={`/learn/courses/${course.id}`} />}
                              size="sm"
                              variant="outline"
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
                        </CardContent>
                      </Card>
                    );
                  })}
                  {projects.slice(0, 6).map((project) => {
                    const price = project.prices[0];
                    if (!price) return null;
                    const redeemed = myRedeemedProjectIds.has(project.id);
                    const affordable = balance >= price.amountMinor;
                    return (
                      <Card key={project.id}>
                        <CardHeader className="pb-2">
                          <div className="flex gap-1">
                            <Badge variant="outline">{project.tier.toLowerCase()}</Badge>
                            <Badge variant="secondary">mentor-reviewed</Badge>
                          </div>
                          <CardTitle className="line-clamp-2 text-sm">{project.title}</CardTitle>
                          <CardDescription>{formatMoney(price.amountMinor)}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          {redeemed ? (
                            <Button
                              render={<Link href="/learn/projects" />}
                              size="sm"
                              variant="outline"
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
                        </CardContent>
                      </Card>
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
