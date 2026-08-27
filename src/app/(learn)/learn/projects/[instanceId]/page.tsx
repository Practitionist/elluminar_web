import { Award, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Pill, type PillTone } from "@/components/shared";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { isStorageConfigured } from "@/lib/storage";
import { tiptapToPlainText } from "@/lib/richtext";

import { MilestoneSubmitForm } from "./milestone-submit-form";

export const metadata = { title: "Project workspace" };

const STATUS_HINT: Record<string, string> = {
  PENDING_KICKOFF: "We're matching you with a mentor — your kickoff call sets the schedule. Fully refundable until kickoff.",
  IN_PROGRESS: "Build. Submit each milestone when it's ready for review.",
  IN_REVIEW: "Your mentor is reviewing the latest submission.",
  CHANGES_REQUESTED: "Your mentor requested changes — check the feedback and resubmit.",
  DEFENSE_PENDING: "Final step: your live defense.",
  PASSED: "Mentor-verified. Your credential is live.",
  FAILED: "Not passed this time — the feedback below explains why.",
};

const PROJECT_STATUS_TONE: Record<string, PillTone> = {
  PENDING_KICKOFF: "neutral",
  IN_PROGRESS: "info",
  IN_REVIEW: "info",
  CHANGES_REQUESTED: "distinction",
  DEFENSE_PENDING: "distinction",
  PASSED: "success",
  FAILED: "destructive",
  WITHDRAWN: "neutral",
  REFUNDED: "neutral",
};

const MILESTONE_STATUS_TONE: Record<string, PillTone> = {
  SUBMITTED: "neutral",
  IN_REVIEW: "info",
  APPROVED: "success",
  CHANGES_REQUESTED: "distinction",
};

const REVIEW_DECISION_TONE: Record<string, PillTone> = {
  APPROVED: "success",
  PASS: "success",
  CHANGES_REQUESTED: "distinction",
  REJECTED: "destructive",
  FAIL: "destructive",
};

export default async function ProjectWorkspacePage({
  params,
}: {
  params: Promise<{ instanceId: string }>;
}) {
  const { instanceId } = await params;
  const session = await requireUser(`/learn/projects/${instanceId}`);

  const instance = await db.projectInstance.findUnique({
    where: { id: instanceId },
    include: {
      project: {
        include: {
          tenant: { select: { displayName: true } },
          milestones: { orderBy: { position: "asc" } },
        },
      },
      mentorAssignments: {
        where: { unassignedAt: null },
        include: { mentorProfile: { include: { user: { select: { name: true } } } } },
      },
      milestoneSubmissions: { orderBy: { submittedAt: "desc" } },
      projectReviews: {
        where: { status: "COMPLETED" },
        orderBy: { completedAt: "desc" },
        include: { rubricScores: { include: { rubricCriterion: true } } },
      },
      credentials: true,
    },
  });
  if (!instance || instance.userId !== session.user.id) notFound();

  const mentor = instance.mentorAssignments[0]?.mentorProfile;
  const submissionsByMilestone = new Map<string, typeof instance.milestoneSubmissions>();
  for (const s of instance.milestoneSubmissions) {
    const list = submissionsByMilestone.get(s.milestoneId) ?? [];
    list.push(s);
    submissionsByMilestone.set(s.milestoneId, list);
  }
  const canSubmit = ["IN_PROGRESS", "CHANGES_REQUESTED"].includes(instance.status);

  const storageReady = isStorageConfigured();

  return (
    <div className="space-y-6">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div>
          <Link
            href="/learn/projects"
            className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
            My projects
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
              {instance.project.title}
            </h1>
            <Pill tone="distinction">{instance.project.tier.toLowerCase()}</Pill>
            <Pill tone={PROJECT_STATUS_TONE[instance.status] ?? "neutral"}>
              {instance.status.toLowerCase().replace(/_/g, " ")}
            </Pill>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {instance.project.tenant.displayName}
            {mentor ? ` · mentor: ${mentor.user.name} (${mentor.level.toLowerCase()})` : ""}
            {instance.mentorKickoffAt
              ? ` · kickoff ${instance.mentorKickoffAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`
              : ""}
          </p>
          {STATUS_HINT[instance.status] ? (
            <p className="mt-3 text-sm font-semibold">{STATUS_HINT[instance.status]}</p>
          ) : null}
          {instance.credentials[0] && (
            <Link
              href={`/verify/${instance.credentials[0].verificationCode}`}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
            >
              <Award className="size-4" />
              Credential: {instance.credentials[0].verificationCode}
            </Link>
          )}
        </div>

        <div className="space-y-4">
          {instance.project.milestones.map((m, i) => {
            const subs = submissionsByMilestone.get(m.id) ?? [];
            const latest = subs[0];
            return (
              <div key={m.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-base font-extrabold">
                    {i + 1}. {m.title}
                  </span>
                  <span className="flex gap-2">
                    {m.isReviewCheckpoint && <Pill tone="info">mentor review</Pill>}
                    {latest && (
                      <Pill tone={MILESTONE_STATUS_TONE[latest.status] ?? "neutral"}>
                        {latest.status.toLowerCase().replace(/_/g, " ")}
                      </Pill>
                    )}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {tiptapToPlainText(m.description)}
                </p>
                {subs.length > 0 && (
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    {subs.map((s) => (
                      <p key={s.id}>
                        Attempt {s.attemptNo} ·{" "}
                        {s.submittedAt.toLocaleDateString("en-IN", { dateStyle: "medium" })} ·{" "}
                        {s.status.toLowerCase().replace(/_/g, " ")}
                        {s.repoUrl ? (
                          <>
                            {" · "}
                            <a
                              href={s.repoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="font-semibold text-primary hover:underline"
                            >
                              repo
                            </a>
                          </>
                        ) : null}
                      </p>
                    ))}
                  </div>
                )}
                {canSubmit && latest?.status !== "APPROVED" && (
                  <div className="mt-3">
                    <MilestoneSubmitForm
                      projectInstanceId={instance.id}
                      milestoneId={m.id}
                      storageReady={storageReady}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {instance.projectReviews.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base font-extrabold">Mentor feedback</h2>
            {instance.projectReviews.map((r) => (
              <div key={r.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold">
                    {r.kind.toLowerCase().replace(/_/g, " ")}
                  </span>
                  <span className="flex items-center gap-2">
                    {r.overallScore != null && (
                      <span className="text-sm font-extrabold tabular-nums">
                        {Math.round(r.overallScore)}%
                      </span>
                    )}
                    {r.decision && (
                      <Pill tone={REVIEW_DECISION_TONE[r.decision] ?? "neutral"}>
                        {r.decision.toLowerCase()}
                      </Pill>
                    )}
                  </span>
                </div>
                <p className="mt-2 text-sm whitespace-pre-line">
                  {(r.summary as { text?: string } | null)?.text ?? ""}
                </p>
                {r.rubricScores.length > 0 && (
                  <div className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
                    {r.rubricScores.map((s) => (
                      <p key={s.id}>
                        {s.rubricCriterion.name}: {s.score}/{s.maxScore}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
