import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { tiptapToPlainText } from "@/lib/richtext";

import { FinalizeForm, ReviewForm } from "./review-forms";

export const metadata = { title: "Review project" };

export default async function MentorInstancePage({
  params,
}: {
  params: Promise<{ instanceId: string }>;
}) {
  const { instanceId } = await params;
  const session = await requireUser(`/mentor/instances/${instanceId}`);

  const assignment = await db.mentorAssignment.findFirst({
    where: {
      projectInstanceId: instanceId,
      unassignedAt: null,
      mentorProfile: { userId: session.user.id },
    },
  });
  if (!assignment) notFound();

  const instance = await db.projectInstance.findUnique({
    where: { id: instanceId },
    include: {
      user: { select: { name: true, email: true } },
      project: {
        include: {
          milestones: { orderBy: { position: "asc" } },
          rubric: { include: { criteria: { orderBy: { position: "asc" } } } },
        },
      },
      milestoneSubmissions: { orderBy: { submittedAt: "desc" } },
      projectReviews: {
        orderBy: { createdAt: "desc" },
        include: { milestoneSubmission: true },
      },
    },
  });
  if (!instance) notFound();

  const pendingReviews = instance.projectReviews.filter((r) => r.status !== "COMPLETED");
  const milestoneById = new Map(instance.project.milestones.map((m) => [m.id, m]));
  const finalized = ["PASSED", "FAILED", "REFUNDED", "WITHDRAWN"].includes(instance.status);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <Link href="/mentor" className="text-sm text-muted-foreground hover:text-foreground">
          ← Mentor workspace
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{instance.project.title}</h1>
          <Badge>{instance.project.tier.toLowerCase()}</Badge>
          <Badge variant="outline">{instance.status.toLowerCase().replace(/_/g, " ")}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Learner: {instance.user.name} · {instance.user.email}
          {instance.dueAt
            ? ` · due ${instance.dueAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}`
            : ""}
        </p>
      </div>

      {pendingReviews.map((review) => {
        const submission = review.milestoneSubmission;
        const milestone = submission ? milestoneById.get(submission.milestoneId) : null;
        if (!submission || !milestone) return null;
        return (
          <Card key={review.id} className="border-primary/50">
            <CardHeader>
              <CardTitle className="text-base">
                Awaiting review: {milestone.title}{" "}
                <span className="font-normal text-muted-foreground">
                  (attempt {submission.attemptNo})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1 text-sm">
                {submission.repoUrl && (
                  <p>
                    Repo:{" "}
                    <a href={submission.repoUrl} target="_blank" rel="noreferrer" className="underline">
                      {submission.repoUrl}
                    </a>
                  </p>
                )}
                {submission.artifactUrl && (
                  <p>
                    Artifact:{" "}
                    <a href={submission.artifactUrl} target="_blank" rel="noreferrer" className="underline">
                      {submission.artifactUrl}
                    </a>
                  </p>
                )}
                <p className="whitespace-pre-line text-muted-foreground">
                  {tiptapToPlainText(submission.notes) || "No notes."}
                </p>
              </div>
              <ReviewForm
                projectReviewId={review.id}
                criteria={instance.project.rubric.criteria.map((c) => ({
                  id: c.id,
                  name: c.name,
                  weightPct: c.weightPct,
                }))}
              />
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Submission history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {instance.milestoneSubmissions.length === 0 ? (
            <p className="text-muted-foreground">Nothing submitted yet.</p>
          ) : (
            instance.milestoneSubmissions.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                <span>
                  {milestoneById.get(s.milestoneId)?.title} · attempt {s.attemptNo}
                </span>
                <Badge variant="outline">{s.status.toLowerCase().replace(/_/g, " ")}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {!finalized && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Final verdict</CardTitle>
          </CardHeader>
          <CardContent>
            <FinalizeForm projectInstanceId={instance.id} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
