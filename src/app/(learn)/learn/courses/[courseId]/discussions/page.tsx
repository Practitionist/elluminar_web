import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/learn/courses/${courseId}`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to course
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Discussions</h1>
        </div>
      </div>

      <NewThreadForm courseId={courseId} />

      <div className="space-y-2">
        {threads.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No questions yet — ask the first one.
          </p>
        ) : (
          threads.map((t) => (
            <Link key={t.id} href={`/learn/courses/${courseId}/discussions/${t.id}`}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {t.pinned && <Badge variant="secondary">pinned</Badge>}
                      {t.status === "RESOLVED" && <Badge>resolved</Badge>}
                      <span className="truncate font-medium">{t.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t.author.name} ·{" "}
                      {t.lastActivityAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {t.replyCount} replies
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
