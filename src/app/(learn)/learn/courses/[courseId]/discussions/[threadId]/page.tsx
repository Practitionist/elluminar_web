import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { tiptapToPlainText } from "@/lib/richtext";

import { ReplyForm } from "./reply-form";

export const metadata = { title: "Discussion" };

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ courseId: string; threadId: string }>;
}) {
  const { courseId, threadId } = await params;
  const session = await requireUser(`/learn/courses/${courseId}/discussions/${threadId}`);

  const thread = await db.discussionThread.findUnique({
    where: { id: threadId },
    include: {
      author: { select: { id: true, name: true } },
      posts: {
        where: { status: "VISIBLE" },
        orderBy: [{ isAccepted: "desc" }, { createdAt: "asc" }],
        include: { author: { select: { name: true } } },
      },
    },
  });
  if (!thread || thread.courseId !== courseId) notFound();

  const isAuthor = thread.author.id === session.user.id;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={`/learn/courses/${courseId}/discussions`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← All discussions
      </Link>

      <div>
        <div className="flex items-center gap-2">
          {thread.status === "RESOLVED" && <Badge>resolved</Badge>}
          <h1 className="text-2xl font-semibold tracking-tight">{thread.title}</h1>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {thread.author.name} ·{" "}
          {thread.createdAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}
        </p>
        <p className="mt-3 whitespace-pre-line text-sm">{tiptapToPlainText(thread.body)}</p>
      </div>

      <div className="space-y-3">
        {thread.posts.map((post) => (
          <Card key={post.id} className={post.isAccepted ? "border-green-600/50" : ""}>
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {post.author.name} ·{" "}
                  {post.createdAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}
                </p>
                {post.isAccepted && <Badge variant="secondary">accepted answer ✓</Badge>}
              </div>
              <p className="mt-2 whitespace-pre-line text-sm">
                {tiptapToPlainText(post.body)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <ReplyForm
        threadId={thread.id}
        canAccept={isAuthor && thread.status !== "RESOLVED"}
        posts={thread.posts.map((p) => ({ id: p.id, author: p.author.name }))}
      />
    </div>
  );
}
