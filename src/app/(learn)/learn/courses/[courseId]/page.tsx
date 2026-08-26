import {
  Check,
  ChevronLeft,
  ClipboardCheck,
  Code2,
  FileText,
  HelpCircle,
  Lock,
  MessageSquare,
  Paperclip,
  PlayCircle,
  ScreenShare,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Pill } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { requireUser } from "@/lib/auth/session";
import { resolveCourseAccess } from "@/lib/commerce/entitlements";
import { db } from "@/lib/db";
import { fermionSchoolHostname } from "@/lib/fermion/client";
import { getVideoPlayback } from "@/lib/fermion/video";
import { isLessonUnlocked } from "@/lib/learning/lesson-access";
import { tiptapToPlainText } from "@/lib/richtext";
import { getSignedReadUrl, isStorageConfigured } from "@/lib/storage";
import { cn } from "@/lib/utils";

import { AssignmentPanel } from "./assignment-panel";
import { CodeLabFrame } from "./code-lab-frame";
import { MarkCompleteButton } from "./mark-complete-button";
import { VideoLessonPlayer } from "./video-lesson-player";

const LESSON_TYPE_ICON: Record<string, React.ElementType> = {
  VIDEO: PlayCircle,
  ARTICLE: FileText,
  QUIZ: HelpCircle,
  ASSIGNMENT: ClipboardCheck,
  CODE_LAB: Code2,
  RESOURCE: Paperclip,
  EMBED: ScreenShare,
};

export const metadata = { title: "Course player" };

export default async function CoursePlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ lesson?: string }>;
}) {
  const { courseId } = await params;
  const { lesson: lessonParam } = await searchParams;
  const session = await requireUser(`/learn/courses/${courseId}`);

  const { access, enrollment } = await resolveCourseAccess(session.user.id, courseId);
  const course = await db.course.findUnique({
    where: { id: courseId },
    include: {
      tenant: { select: { slug: true, displayName: true } },
      sections: {
        orderBy: { position: "asc" },
        include: { lessons: { orderBy: { position: "asc" } } },
      },
    },
  });
  if (!course) notFound();
  if (!access || !enrollment) {
    redirect(`/courses/${course.tenant.slug}/${course.slug}`);
  }

  const progress = await db.lessonProgress.findMany({
    where: { enrollmentId: enrollment.id },
  });
  const progressByLesson = new Map(progress.map((p) => [p.lessonId, p]));

  const allLessons = course.sections.flatMap((s) => s.lessons);
  const activeLesson =
    allLessons.find((l) => l.id === lessonParam) ??
    allLessons.find((l) => progressByLesson.get(l.id)?.status !== "COMPLETED") ??
    allLessons[0];
  if (!activeLesson) {
    return (
      <div className="rounded-2xl border border-border bg-card px-6 py-16 text-center text-sm text-muted-foreground">
        This course has no lessons yet.
      </div>
    );
  }

  const { unlocked, unlocksAt } = isLessonUnlocked(activeLesson, enrollment);
  const activeProgress = progressByLesson.get(activeLesson.id);
  const isCompleted = activeProgress?.status === "COMPLETED";

  // Type-specific data
  let playback: Awaited<ReturnType<typeof getVideoPlayback>> | null = null;
  if (unlocked && activeLesson.type === "VIDEO" && activeLesson.videoAssetId) {
    playback = await getVideoPlayback(activeLesson.videoAssetId, session.user.id).catch(
      () => null,
    );
  }
  const assignment =
    unlocked && activeLesson.type === "ASSIGNMENT"
      ? await db.assignment.findUnique({
          where: { lessonId: activeLesson.id },
          include: {
            submissions: {
              where: { userId: session.user.id },
              orderBy: { attemptNo: "desc" },
            },
          },
        })
      : null;
  const quiz =
    unlocked && activeLesson.type === "QUIZ"
      ? await db.quiz.findUnique({
          where: { lessonId: activeLesson.id },
          include: {
            attempts: {
              where: { userId: session.user.id },
              orderBy: { attemptNo: "desc" },
            },
            _count: { select: { questions: true } },
          },
        })
      : null;
  const resources =
    unlocked && activeLesson.type === "RESOURCE"
      ? await db.lessonResource.findMany({
          where: { lessonId: activeLesson.id },
          include: { mediaAsset: true },
        })
      : [];
  const resourceLinks = isStorageConfigured()
    ? await Promise.all(
        resources.map(async (r) => ({
          id: r.id,
          title: r.title ?? r.mediaAsset.filename,
          url: await getSignedReadUrl(r.mediaAssetId).catch(() => null),
        })),
      )
    : resources.map((r) => ({ id: r.id, title: r.title ?? r.mediaAsset.filename, url: null }));

  const embedUrl = (activeLesson.content as { embedUrl?: string } | null)?.embedUrl;
  const TypeIcon = LESSON_TYPE_ICON[activeLesson.type] ?? FileText;

  return (
    <div className="space-y-5">
      <Link
        href={`/courses/${course.tenant.slug}/${course.slug}`}
        className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        {course.title}
      </Link>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr] lg:items-start">
        <aside className="space-y-4 lg:sticky lg:top-6">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-1.5 flex items-center justify-between text-xs font-bold">
              <span>Your progress</span>
              <span className="tabular-nums text-muted-foreground">
                {Math.round(enrollment.progressPct)}%
              </span>
            </div>
            <Progress value={enrollment.progressPct} className="h-2" />
            <Link
              href={`/learn/courses/${courseId}/discussions`}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
            >
              <MessageSquare className="size-3.5" />
              Discussions
            </Link>
          </div>

          <nav className="space-y-4 rounded-2xl border border-border bg-card p-4">
            {course.sections.map((section) => (
              <div key={section.id}>
                <p className="px-2.5 text-[11px] font-extrabold tracking-wide text-muted-foreground uppercase">
                  {section.title}
                </p>
                <div className="mt-1 space-y-0.5">
                  {section.lessons.map((lesson) => {
                    const p = progressByLesson.get(lesson.id);
                    const { unlocked: lessonUnlocked } = isLessonUnlocked(lesson, enrollment);
                    const isActive = lesson.id === activeLesson.id;
                    const isDone = p?.status === "COMPLETED";
                    return (
                      <Link
                        key={lesson.id}
                        href={`/learn/courses/${courseId}?lesson=${lesson.id}`}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                          isActive
                            ? "bg-primary-subtle font-bold text-primary-subtle-foreground"
                            : "font-semibold text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        <span
                          className={cn(
                            "inline-flex size-5 shrink-0 items-center justify-center rounded-full",
                            isDone
                              ? "bg-success text-success-foreground"
                              : lessonUnlocked
                                ? "border-2 border-current opacity-30"
                                : "text-muted-foreground/40",
                          )}
                        >
                          {isDone ? (
                            <Check className="size-3" strokeWidth={3} />
                          ) : !lessonUnlocked ? (
                            <Lock className="size-2.5" />
                          ) : null}
                        </span>
                        <span className="line-clamp-1 flex-1">{lesson.title}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Pill tone="primary" className="uppercase tracking-wide">
                <TypeIcon className="size-3" />
                {activeLesson.type.toLowerCase().replace("_", " ")}
              </Pill>
              <h1 className="mt-2 font-display text-2xl font-medium tracking-tight sm:text-3xl">
                {activeLesson.title}
              </h1>
            </div>
            {unlocked && activeLesson.type !== "QUIZ" && activeLesson.type !== "ASSIGNMENT" && (
              <MarkCompleteButton
                courseId={courseId}
                lessonId={activeLesson.id}
                completed={isCompleted}
              />
            )}
          </div>

          {!unlocked ? (
            <div className="rounded-2xl border border-border bg-card px-6 py-16 text-center">
              <Lock className="mx-auto size-6 text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">
                This lesson unlocks
                {unlocksAt
                  ? ` on ${unlocksAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}`
                  : " later"}
                .
              </p>
            </div>
          ) : activeLesson.type === "VIDEO" ? (
            <VideoLessonPlayer
              courseId={courseId}
              lessonId={activeLesson.id}
              playback={
                playback?.kind === "external"
                  ? { kind: "external", url: playback.url }
                  : playback?.kind === "fermion"
                    ? {
                        kind: "fermion",
                        videoId: playback.videoId,
                        jwtToken: playback.jwtToken,
                        websiteHostname: playback.websiteHostname,
                      }
                    : { kind: "pending" }
              }
              resumeAt={activeProgress?.lastPositionSec ?? 0}
            />
          ) : activeLesson.type === "ARTICLE" ? (
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="prose prose-sm max-w-none whitespace-pre-line dark:prose-invert">
                {tiptapToPlainText(activeLesson.content) || "No content yet."}
              </div>
            </div>
          ) : activeLesson.type === "QUIZ" && quiz ? (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-base font-extrabold">{quiz.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {quiz.drawCount ?? quiz._count.questions} questions · pass at {quiz.passPct}%
                {quiz.timeLimitSec ? ` · ${Math.round(quiz.timeLimitSec / 60)} min limit` : ""}
                {quiz.maxAttempts ? ` · ${quiz.maxAttempts} attempts` : ""}
              </p>
              {quiz.attempts.length > 0 && (
                <div className="mt-3 space-y-1">
                  {quiz.attempts.slice(0, 3).map((a) => (
                    <p key={a.id} className="text-xs text-muted-foreground">
                      Attempt {a.attemptNo}:{" "}
                      {a.submittedAt
                        ? `${a.scorePoints}/${a.maxPoints} — ${a.passed ? "passed ✓" : "not passed"}`
                        : "in progress"}
                    </p>
                  ))}
                </div>
              )}
              <Button
                render={<Link href={`/learn/courses/${courseId}/quiz/${activeLesson.id}`} />}
                className="mt-4 rounded-full"
              >
                {quiz.attempts.some((a) => !a.submittedAt)
                  ? "Resume attempt"
                  : quiz.attempts.length > 0
                    ? "Try again"
                    : "Start quiz"}
              </Button>
            </div>
          ) : activeLesson.type === "ASSIGNMENT" && assignment ? (
            <AssignmentPanel
              courseId={courseId}
              lessonId={activeLesson.id}
              assignment={{
                title: assignment.title,
                instructions: tiptapToPlainText(assignment.instructions),
                maxPoints: assignment.maxPoints,
                submissionKinds: assignment.submissionKinds,
                allowResubmission: assignment.allowResubmission,
              }}
              submissions={assignment.submissions.map((s) => ({
                id: s.id,
                attemptNo: s.attemptNo,
                status: s.status,
                scorePoints: s.scorePoints,
                maxPoints: assignment.maxPoints,
                feedback: (s.feedback as { text?: string } | null)?.text ?? null,
                submittedAt: s.submittedAt?.toISOString() ?? null,
              }))}
            />
          ) : activeLesson.type === "CODE_LAB" ? (
            <CodeLabFrame
              courseId={courseId}
              lessonId={activeLesson.id}
              labRef={(activeLesson.labConfig as { labRef?: string } | null)?.labRef ?? null}
              expectedOrigin={
                (() => {
                  try {
                    return `https://${fermionSchoolHostname()}`;
                  } catch {
                    return "";
                  }
                })()
              }
            />
          ) : activeLesson.type === "RESOURCE" ? (
            <div className="space-y-2 rounded-2xl border border-border bg-card p-5">
              {resourceLinks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No files attached.</p>
              ) : (
                resourceLinks.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm"
                  >
                    <span className="font-semibold">{r.title}</span>
                    {r.url ? (
                      <Button
                        render={<a href={r.url} target="_blank" rel="noreferrer" />}
                        variant="outline"
                        size="sm"
                      >
                        Download
                      </Button>
                    ) : (
                      <Pill tone="neutral">storage not configured</Pill>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : activeLesson.type === "EMBED" && embedUrl ? (
            <div className="aspect-video w-full overflow-hidden rounded-2xl border border-border">
              <iframe src={embedUrl} className="h-full w-full" allowFullScreen />
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card px-6 py-16 text-center text-sm text-muted-foreground">
              Nothing to show for this lesson yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
