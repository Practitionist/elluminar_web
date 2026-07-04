import Link from "next/link";

import { Pill } from "@/components/shared";
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
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
            Become a mentor
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Review real projects, run checkpoints and defenses, get paid per
            review — 50–60% of the mentor-attributable fee.
          </p>
        </div>
        <MentorApplyForm />
      </div>
    );
  }

  if (profile.status !== "ACTIVE") {
    return (
      <div className="mx-auto max-w-xl space-y-3 py-12 text-center">
        <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
          Application received
        </h1>
        <p className="text-muted-foreground">
          Status{" "}
          <Pill tone="distinction">{profile.status.toLowerCase()}</Pill> — we&apos;ll
          notify you once vetting completes.
        </p>
      </div>
    );
  }

  const pendingReviews = await db.projectReview.findMany({
    where: {
      status: { in: ["PENDING", "IN_PROGRESS"] },
      projectInstance: {
        mentorAssignments: {
          some: { mentorProfileId: profile.id, unassignedAt: null },
        },
      },
    },
    orderBy: { turnaroundTargetAt: "asc" },
    include: {
      projectInstance: {
        include: {
          project: { select: { title: true } },
          user: { select: { name: true } },
        },
      },
    },
  });

  const balance = profile.ledgerAccounts.find((a) => a.currency === "INR");

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
            Mentor workspace
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {profile.headline} · {profile.level.toLowerCase()} ·{" "}
            {profile.assignments.length}/{profile.maxActiveInstances} active
          </p>
        </div>
        {balance ? (
          <div className="rounded-2xl border border-border bg-card px-5 py-3 text-right">
            <p className="text-[11px] font-bold text-muted-foreground">
              Earnings balance
            </p>
            <p className="text-xl font-extrabold">
              {formatMoney(balance.balanceCachedMinor)}
            </p>
          </div>
        ) : null}
      </div>

      <section>
        <h2 className="mb-3 text-base font-extrabold">Reviews waiting on you</h2>
        {pendingReviews.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-6 py-8 text-center text-sm text-muted-foreground">
            All caught up 🎉
          </div>
        ) : (
          <div className="space-y-2.5">
            {pendingReviews.map((r) => {
              const overdue =
                r.turnaroundTargetAt && r.turnaroundTargetAt < new Date();
              return (
                <Link
                  key={r.id}
                  href={`/mentor/instances/${r.projectInstanceId}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-4 text-sm transition-colors hover:border-primary/40"
                >
                  <div>
                    <span className="font-extrabold">
                      {r.projectInstance.project.title}
                    </span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {r.projectInstance.user.name}
                    </span>
                  </div>
                  <Pill tone={overdue ? "destructive" : "distinction"}>
                    {r.turnaroundTargetAt
                      ? `⏱ ${r.turnaroundTargetAt.toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}`
                      : "no SLA"}
                  </Pill>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-extrabold">Active assignments</h2>
        {profile.assignments.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-6 py-8 text-center text-sm text-muted-foreground">
            None yet — you&apos;ll be matched as purchases come in.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {profile.assignments.map((a) => (
              <Link
                key={a.id}
                href={`/mentor/instances/${a.projectInstanceId}`}
                className="rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center gap-2">
                  <Pill tone="distinction" className="px-2 py-0.5 text-[10px]">
                    {a.projectInstance.project.tier.toLowerCase()}
                  </Pill>
                  <Pill tone="neutral" className="px-2 py-0.5 text-[10px]">
                    {a.projectInstance.status.toLowerCase().replace(/_/g, " ")}
                  </Pill>
                </div>
                <div className="mt-2 text-sm font-extrabold">
                  {a.projectInstance.project.title}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Learner: {a.projectInstance.user.name}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
