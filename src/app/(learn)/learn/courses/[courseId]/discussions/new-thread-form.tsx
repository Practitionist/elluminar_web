"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

import { createThread } from "@/actions/discussions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function NewThreadForm({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { execute, isPending } = useAction(createThread, {
    onSuccess: ({ data }) => {
      toast.success("Question posted");
      setOpen(false);
      if (data) router.push(`/learn/courses/${courseId}/discussions/${data.threadId}`);
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Failed to post"),
  });

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} variant="outline" className="rounded-full">
        + Ask a question
      </Button>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          execute({
            courseId,
            title: String(form.get("title")),
            body: String(form.get("body")),
          });
        }}
        className="space-y-3"
      >
        <Input name="title" placeholder="What's your question?" required minLength={5} />
        <Textarea
          name="body"
          rows={4}
          placeholder="Add details — code, errors, what you tried…"
          required
          minLength={5}
        />
        <div className="flex gap-2">
          <Button type="submit" disabled={isPending} className="rounded-full">
            {isPending ? "Posting…" : "Post question"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
