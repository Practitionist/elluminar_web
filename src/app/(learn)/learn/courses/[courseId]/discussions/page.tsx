import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { Pill } from "@/components/shared";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

import { NewThreadForm } from "./new-thread-form";

export const metadata = { title: "Discussions" };

export default async function DiscussionsPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  await requireUser(`/learn/courses/${courseId}/discussions`);

  const threads = await db.discussionThread.findMany({
    where: { courseId, status: { not: "REMOVED" } },
    orderBy: [{ pinned: "desc" }, { lastActivityAt: "desc" }],
    take: 50,
    include: { author: { select: { name: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div>
          <Link
            href={`/learn/courses/${courseId}`}
            className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
            Back to course
          </Link>
          <h1 className="mt-1 font-display text-2xl font-medium tracking-tight sm:text-3xl">
            Discussions
          </h1>
        </div>

        <NewThreadForm courseId={courseId} />

        <div className="space-y-2">
          {threads.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
              No questions yet — ask the first one.
            </div>
          ) : (
            threads.map((t) => (
              <Link
                key={t.id}
                href={`/learn/courses/${courseId}/discussions/${t.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {t.pinned && <Pill tone="distinction">pinned</Pill>}
                    {t.status === "RESOLVED" && <Pill tone="success">resolved</Pill>}
                    <span className="truncate text-sm font-extrabold">{t.title}</span>
                  </div>
                  <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                    {t.author.name} ·{" "}
                    {t.lastActivityAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-bold text-muted-foreground">
                  {t.replyCount} replies
                </span>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
