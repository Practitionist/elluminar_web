import { Pill } from "@/components/shared";
import { requireTenantMember } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getSignedReadUrl, isStorageConfigured } from "@/lib/storage";

import { GradeForm } from "./grade-form";

export const metadata = { title: "Grading queue" };

const STATUS_TONE = {
  SUBMITTED: "info",
  RESUBMIT_REQUESTED: "distinction",
} as const;

export default async function GradingQueuePage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  await requireTenantMember(tenantSlug, ["owner", "admin", "instructor"]);

  const queue = await db.assignmentSubmission.findMany({
    where: {
      status: { in: ["SUBMITTED", "RESUBMIT_REQUESTED"] },
      assignment: { lesson: { course: { tenant: { slug: tenantSlug } } } },
    },
    orderBy: { submittedAt: "asc" },
    include: {
      user: { select: { name: true, email: true } },
      files: { include: { mediaAsset: { select: { filename: true } } } },
      assignment: {
        select: {
          title: true,
          maxPoints: true,
          lesson: {
            select: {
              title: true,
              courseId: true,
              course: { select: { title: true } },
            },
          },
        },
      },
    },
  });

  const fileLinks = await Promise.all(
    queue.map(async (submission) =>
      isStorageConfigured()
        ? await Promise.all(
            submission.files.map(async (f) => ({
              id: f.id,
              filename: f.mediaAsset.filename,
              url: await getSignedReadUrl(f.mediaAssetId).catch(() => null),
            })),
          )
        : submission.files.map((f) => ({
            id: f.id,
            filename: f.mediaAsset.filename,
            url: null,
          })),
    ),
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-medium tracking-tight">Grading queue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Submissions awaiting review, oldest first. Grading completes the lesson for the
          learner and updates their course progress.
        </p>
      </div>

      {queue.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card px-6 py-16 text-center text-sm text-muted-foreground">
          Nothing to grade — you&apos;re all caught up.
        </div>
      ) : (
        <div className="space-y-4">
          {queue.map((s, i) => {
            const learner = s.user.name || s.user.email;
            return (
              <div key={s.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-bold">{learner}</span>
                      {s.late && <Pill tone="distinction">late</Pill>}
                      <Pill tone={STATUS_TONE[s.status as keyof typeof STATUS_TONE] ?? "neutral"}>
                        {s.status.toLowerCase().replace(/_/g, " ")}
                      </Pill>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Attempt {s.attemptNo} · {s.assignment.lesson.course.title} ·{" "}
                      {s.assignment.title} ({s.assignment.lesson.title})
                    </p>
                    {s.submittedAt && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                        Submitted{" "}
                        {s.submittedAt.toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {s.text && (
                    <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm whitespace-pre-line">
                      {s.text}
                    </div>
                  )}
                  {(s.repoUrl || s.url) && (
                    <div className="flex flex-wrap gap-4 text-sm">
                      {s.repoUrl && (
                        <a
                          href={s.repoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-primary hover:underline"
                        >
                          Repository ↗
                        </a>
                      )}
                      {s.url && (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-primary hover:underline"
                        >
                          Link ↗
                        </a>
                      )}
                    </div>
                  )}
                  {fileLinks[i].length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {fileLinks[i].map((f) =>
                        f.url ? (
                          <a
                            key={f.id}
                            href={f.url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-muted"
                          >
                            ⬇ {f.filename}
                          </a>
                        ) : (
                          <Pill key={f.id} tone="neutral">
                            {f.filename} (storage not configured)
                          </Pill>
                        ),
                      )}
                    </div>
                  )}
                </div>

                <GradeForm submissionId={s.id} maxPoints={s.assignment.maxPoints} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
