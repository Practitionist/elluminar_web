import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Pill } from "@/components/shared";
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
    <div className="space-y-6">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <Link
          href={`/learn/courses/${courseId}/discussions`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          All discussions
        </Link>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            {thread.status === "RESOLVED" && <Pill tone="success">resolved</Pill>}
            <h1 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
              {thread.title}
            </h1>
          </div>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">
            {thread.author.name} ·{" "}
            {thread.createdAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}
          </p>
          <p className="mt-3 text-sm whitespace-pre-line">{tiptapToPlainText(thread.body)}</p>
        </div>

        <div className="space-y-3">
          {thread.posts.map((post) => (
            <div
              key={post.id}
              className={`rounded-2xl border bg-card p-4 ${
                post.isAccepted ? "border-success/50" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-muted-foreground">
                  {post.author.name} ·{" "}
                  {post.createdAt.toLocaleDateString("en-IN", { dateStyle: "medium" })}
                </p>
                {post.isAccepted && <Pill tone="success">accepted answer ✓</Pill>}
              </div>
              <p className="mt-2 text-sm whitespace-pre-line">
                {tiptapToPlainText(post.body)}
              </p>
            </div>
          ))}
        </div>

        <ReplyForm
          threadId={thread.id}
          canAccept={isAuthor && thread.status !== "RESOLVED"}
          posts={thread.posts.map((p) => ({ id: p.id, author: p.author.name }))}
        />
      </div>
    </div>
  );
}
