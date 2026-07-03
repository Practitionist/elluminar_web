"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

import { createThread } from "@/actions/discussions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
      <Button onClick={() => setOpen(true)} variant="outline">
        + Ask a question
      </Button>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
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
            <Button type="submit" disabled={isPending}>
              {isPending ? "Posting…" : "Post question"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
