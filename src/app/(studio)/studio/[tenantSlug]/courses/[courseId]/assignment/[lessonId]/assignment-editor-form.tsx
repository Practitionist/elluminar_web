"use client";

import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

import { upsertAssignment } from "@/actions/course";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const KINDS = [
  { value: "TEXT", label: "Text answer" },
  { value: "FILE", label: "File upload" },
  { value: "REPO_URL", label: "Repository URL" },
  { value: "URL", label: "Link" },
] as const;

export function AssignmentEditorForm({
  tenantSlug,
  courseId,
  lessonId,
  defaults,
}: {
  tenantSlug: string;
  courseId: string;
  lessonId: string;
  defaults: {
    title: string;
    instructions: string;
    gradingType: string;
    maxPoints: number;
    submissionKinds: string[];
    allowResubmission: boolean;
  };
}) {
  const [gradingType, setGradingType] = useState(defaults.gradingType);
  const [kinds, setKinds] = useState<string[]>(defaults.submissionKinds);
  const [allowResubmission, setAllowResubmission] = useState(defaults.allowResubmission);

  const { execute, isPending } = useAction(upsertAssignment, {
    onSuccess: () => toast.success("Assignment saved"),
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (kinds.length === 0) {
      toast.error("Pick at least one submission type");
      return;
    }
    execute({
      tenantSlug,
      courseId,
      lessonId,
      title: String(form.get("title")),
      instructions: String(form.get("instructions")),
      gradingType: gradingType as never,
      maxPoints: Number(form.get("maxPoints") || 100),
      submissionKinds: kinds as never,
      allowResubmission,
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" defaultValue={defaults.title} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="instructions">Instructions</Label>
          <Textarea
            id="instructions"
            name="instructions"
            rows={8}
            defaultValue={defaults.instructions}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Grading</Label>
            <Select value={gradingType} onValueChange={(v) => setGradingType(v ?? "")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MANUAL">Instructor-graded</SelectItem>
                <SelectItem value="PEER">Peer-reviewed</SelectItem>
                <SelectItem value="AUTO">Auto-graded</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxPoints">Max points</Label>
            <Input
              id="maxPoints"
              name="maxPoints"
              type="number"
              min={1}
              defaultValue={defaults.maxPoints}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Submission types</Label>
          <div className="flex flex-wrap gap-4">
            {KINDS.map((k) => (
              <label key={k.value} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={kinds.includes(k.value)}
                  onCheckedChange={(checked) =>
                    setKinds((prev) =>
                      checked ? [...prev, k.value] : prev.filter((v) => v !== k.value),
                    )
                  }
                />
                {k.label}
              </label>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={allowResubmission} onCheckedChange={setAllowResubmission} />
          <Label>Allow resubmission after feedback</Label>
        </div>
        <Button type="submit" disabled={isPending} className="rounded-full">
          {isPending ? "Saving…" : "Save assignment"}
        </Button>
      </form>
    </div>
  );
}
