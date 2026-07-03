import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/learn/projects" className="text-sm text-muted-foreground hover:text-foreground">
          ← My projects
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{instance.project.title}</h1>
          <Badge>{instance.project.tier.toLowerCase()}</Badge>
          <Badge variant="outline">{instance.status.toLowerCase().replace(/_/g, " ")}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {instance.project.tenant.displayName}
          {mentor ? ` · mentor: ${mentor.user.name} (${mentor.level.toLowerCase()})` : ""}
          {instance.mentorKickoffAt
            ? ` · kickoff ${instance.mentorKickoffAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`
            : ""}
        </p>
        <p className="mt-2 text-sm">{STATUS_HINT[instance.status] ?? ""}</p>
        {instance.credentials[0] && (
          <p className="mt-2 text-sm">
            🏆 Credential:{" "}
            <Link
              href={`/verify/${instance.credentials[0].verificationCode}`}
              className="font-medium underline"
            >
              {instance.credentials[0].verificationCode}
            </Link>
          </p>
        )}
      </div>

      <div className="space-y-4">
        {instance.project.milestones.map((m, i) => {
          const subs = submissionsByMilestone.get(m.id) ?? [];
          const latest = subs[0];
          return (
            <Card key={m.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span>
                    {i + 1}. {m.title}
                  </span>
                  <span className="flex gap-2">
                    {m.isReviewCheckpoint && <Badge variant="secondary">mentor review</Badge>}
                    {latest && (
                      <Badge variant="outline">
                        {latest.status.toLowerCase().replace(/_/g, " ")}
                      </Badge>
                    )}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {tiptapToPlainText(m.description)}
                </p>
                {subs.length > 0 && (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {subs.map((s) => (
                      <p key={s.id}>
                        Attempt {s.attemptNo} ·{" "}
                        {s.submittedAt.toLocaleDateString("en-IN", { dateStyle: "medium" })} ·{" "}
                        {s.status.toLowerCase().replace(/_/g, " ")}
                        {s.repoUrl ? (
                          <>
                            {" · "}
                            <a href={s.repoUrl} target="_blank" rel="noreferrer" className="underline">
                              repo
                            </a>
                          </>
                        ) : null}
                      </p>
                    ))}
                  </div>
                )}
                {canSubmit && latest?.status !== "APPROVED" && (
                  <MilestoneSubmitForm projectInstanceId={instance.id} milestoneId={m.id} />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {instance.projectReviews.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Mentor feedback</h2>
          {instance.projectReviews.map((r) => (
            <Card key={r.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span>{r.kind.toLowerCase().replace(/_/g, " ")}</span>
                  <span className="flex items-center gap-2">
                    {r.overallScore != null && (
                      <span className="font-semibold">{Math.round(r.overallScore)}%</span>
                    )}
                    {r.decision && <Badge variant="outline">{r.decision.toLowerCase()}</Badge>}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="whitespace-pre-line">
                  {(r.summary as { text?: string } | null)?.text ?? ""}
                </p>
                {r.rubricScores.length > 0 && (
                  <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
                    {r.rubricScores.map((s) => (
                      <p key={s.id}>
                        {s.rubricCriterion.name}: {s.score}/{s.maxScore}
                      </p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
