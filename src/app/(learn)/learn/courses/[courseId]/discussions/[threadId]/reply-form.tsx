"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { acceptAnswer, replyToThread } from "@/actions/discussions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

export function ReplyForm({
  threadId,
  canAccept,
  posts,
}: {
  threadId: string;
  canAccept: boolean;
  posts: Array<{ id: string; author: string }>;
}) {
  const router = useRouter();
  const [acceptId, setAcceptId] = useState("");

  const reply = useAction(replyToThread, {
    onSuccess: () => {
      toast.success("Reply posted");
      router.refresh();
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });
  const accept = useAction(acceptAnswer, {
    onSuccess: () => {
      toast.success("Answer accepted");
      router.refresh();
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          reply.execute({ threadId, body: String(form.get("body")) });
          e.currentTarget.reset();
        }}
        className="space-y-3"
      >
        <Textarea name="body" rows={3} placeholder="Write a reply…" required minLength={2} />
        <Button type="submit" disabled={reply.isPending} className="rounded-full">
          {reply.isPending ? "Posting…" : "Reply"}
        </Button>
      </form>

      {canAccept && posts.length > 0 && (
        <div className="flex items-center gap-2 border-t border-border pt-4">
          <Select value={acceptId} onValueChange={(v) => setAcceptId(v ?? "")}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Mark an answer as accepted" />
            </SelectTrigger>
            <SelectContent>
              {posts.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  Reply by {p.author}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className="rounded-full"
            disabled={!acceptId || accept.isPending}
            onClick={() => accept.execute({ threadId, postId: acceptId })}
          >
            Accept
          </Button>
        </div>
      )}
    </div>
  );
}
