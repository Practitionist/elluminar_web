"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { applyAsMentor } from "@/actions/mentor";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function MentorApplyForm() {
  const router = useRouter();
  const { execute, isPending } = useAction(applyAsMentor, {
    onSuccess: () => {
      toast.success("Application submitted");
      router.refresh();
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });

  return (
    <Card>
      <CardContent className="pt-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            execute({
              headline: String(form.get("headline")),
              bio: String(form.get("bio")),
              expertiseTags: String(form.get("expertise") || "")
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
              level: "ASSOCIATE",
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="headline">Headline</Label>
            <Input
              id="headline"
              name="headline"
              required
              placeholder="Senior Backend Engineer · 8y distributed systems"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expertise">Expertise (comma-separated)</Label>
            <Input id="expertise" name="expertise" required placeholder="golang, postgres, system-design" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">Why you&apos;d be a great reviewer</Label>
            <Textarea id="bio" name="bio" rows={5} required minLength={30} />
          </div>
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Submitting…" : "Apply to mentor"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
