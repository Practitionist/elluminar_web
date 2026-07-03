import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";

import { MentorApplyForm } from "./mentor-apply-form";

export const metadata = { title: "Mentor workspace" };

export default async function MentorDashboardPage() {
  const session = await requireUser("/mentor");

  const profile = await db.mentorProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      assignments: {
        where: { unassignedAt: null },
        include: {
          projectInstance: {
            include: {
              project: { select: { title: true, tier: true } },
              user: { select: { name: true } },
            },
          },
        },
      },
      ledgerAccounts: true,
    },
  });

  if (!profile) {
    return (
      <div className="mx-auto max-w-xl space-y-6 px-4 py-12">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Become a mentor</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review real projects, run checkpoints and defenses, get paid per review —
            50–60% of the mentor-attributable fee.
          </p>
        </div>
        <MentorApplyForm />
      </div>
    );
  }

  if (profile.status !== "ACTIVE") {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Application received</h1>
        <p className="mt-2 text-muted-foreground">
          Status: <Badge variant="secondary">{profile.status.toLowerCase()}</Badge> — we&apos;ll
          notify you once vetting completes.
        </p>
      </div>
    );
  }

  const pendingReviews = await db.projectReview.findMany({
    where: {
      status: { in: ["PENDING", "IN_PROGRESS"] },
      projectInstance: {
        mentorAssignments: { some: { mentorProfileId: profile.id, unassignedAt: null } },
      },
    },
    orderBy: { turnaroundTargetAt: "asc" },
    include: {
      projectInstance: {
        include: { project: { select: { title: true } }, user: { select: { name: true } } },
      },
    },
  });

  const balance = profile.ledgerAccounts.find((a) => a.currency === "INR");

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mentor workspace</h1>
          <p className="text-sm text-muted-foreground">
            {profile.headline} · {profile.level.toLowerCase()} ·{" "}
            {profile.assignments.length}/{profile.maxActiveInstances} active
          </p>
        </div>
        {balance && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Earnings balance</p>
            <p className="text-xl font-semibold">{formatMoney(balance.balanceCachedMinor)}</p>
          </div>
        )}
      </div>

      <section>
        <h2 className="text-lg font-semibold">Reviews waiting on you</h2>
        {pendingReviews.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">All caught up 🎉</p>
        ) : (
          <div className="mt-3 space-y-2">
            {pendingReviews.map((r) => {
              const overdue = r.turnaroundTargetAt && r.turnaroundTargetAt < new Date();
              return (
                <Link key={r.id} href={`/mentor/instances/${r.projectInstanceId}`}>
                  <Card className="transition-colors hover:bg-muted/50">
                    <CardContent className="flex items-center justify-between py-3 text-sm">
                      <div>
                        <span className="font-medium">{r.projectInstance.project.title}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          · {r.projectInstance.user.name}
                        </span>
                      </div>
                      <Badge variant={overdue ? "destructive" : "outline"}>
                        {r.turnaroundTargetAt
                          ? `SLA ${r.turnaroundTargetAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`
                          : "no SLA"}
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Active assignments</h2>
        {profile.assignments.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            None yet — you&apos;ll be matched as purchases come in.
          </p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {profile.assignments.map((a) => (
              <Link key={a.id} href={`/mentor/instances/${a.projectInstanceId}`}>
                <Card className="h-full transition-colors hover:bg-muted/50">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Badge>{a.projectInstance.project.tier.toLowerCase()}</Badge>
                      <Badge variant="outline">
                        {a.projectInstance.status.toLowerCase().replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <CardTitle className="mt-1 text-base">
                      {a.projectInstance.project.title}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Learner: {a.projectInstance.user.name}
                    </p>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
