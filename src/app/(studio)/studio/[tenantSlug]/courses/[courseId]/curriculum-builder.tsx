"use client";

import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

import {
  deleteEntity,
  reorderEntity,
  upsertLesson,
  upsertSection,
} from "@/actions/course";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

type LessonRow = {
  id: string;
  title: string;
  type: string;
  isFreePreview: boolean;
  releaseAfterDays: number | null;
  durationSec: number | null;
  videoStatus: string | null;
  labRef: string | null;
};

type SectionRow = { id: string; title: string; lessons: LessonRow[] };

const LESSON_TYPES = [
  { value: "VIDEO", label: "Video" },
  { value: "ARTICLE", label: "Article" },
  { value: "QUIZ", label: "Quiz" },
  { value: "ASSIGNMENT", label: "Assignment" },
  { value: "CODE_LAB", label: "Code lab" },
  { value: "RESOURCE", label: "Resource" },
  { value: "EMBED", label: "Embed" },
];

export function CurriculumBuilder({
  tenantSlug,
  courseId,
  sections,
}: {
  tenantSlug: string;
  courseId: string;
  sections: SectionRow[];
}) {
  const sectionAction = useAction(upsertSection, {
    onSuccess: () => toast.success("Section saved"),
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });
  const reorder = useAction(reorderEntity, {
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });
  const remove = useAction(deleteEntity, {
    onSuccess: () => toast.success("Deleted"),
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });

  function addSection() {
    const title = window.prompt("Section title");
    if (title) sectionAction.execute({ tenantSlug, courseId, title });
  }

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <Card key={section.id}>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{section.title}</CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                title="Move up"
                onClick={() =>
                  reorder.execute({ tenantSlug, courseId, kind: "SECTION", id: section.id, direction: "UP" })
                }
              >
                ↑
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                title="Move down"
                onClick={() =>
                  reorder.execute({ tenantSlug, courseId, kind: "SECTION", id: section.id, direction: "DOWN" })
                }
              >
                ↓
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                title="Rename"
                onClick={() => {
                  const title = window.prompt("Section title", section.title);
                  if (title)
                    sectionAction.execute({ tenantSlug, courseId, sectionId: section.id, title });
                }}
              >
                ✎
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                title="Delete section"
                onClick={() => {
                  if (window.confirm("Delete this section and all its lessons?"))
                    remove.execute({ tenantSlug, courseId, kind: "SECTION", id: section.id });
                }}
              >
                ✕
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {section.lessons.map((lesson) => (
              <div
                key={lesson.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Badge variant="outline" className="shrink-0">
                    {lesson.type.toLowerCase().replace("_", " ")}
                  </Badge>
                  <span className="truncate text-sm">{lesson.title}</span>
                  {lesson.isFreePreview && (
                    <Badge variant="secondary" className="shrink-0">
                      preview
                    </Badge>
                  )}
                  {lesson.type === "VIDEO" && lesson.videoStatus && (
                    <Badge variant="outline" className="shrink-0">
                      {lesson.videoStatus.toLowerCase()}
                    </Badge>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {lesson.type === "QUIZ" && (
                    <Button
                      variant="outline"
                      size="sm"
                      render={
                        <Link
                          href={`/studio/${tenantSlug}/courses/${courseId}/quiz/${lesson.id}`}
                        />
                      }
                    >
                      Questions
                    </Button>
                  )}
                  {lesson.type === "ASSIGNMENT" && (
                    <Button
                      variant="outline"
                      size="sm"
                      render={
                        <Link
                          href={`/studio/${tenantSlug}/courses/${courseId}/assignment/${lesson.id}`}
                        />
                      }
                    >
                      Configure
                    </Button>
                  )}
                  <LessonDialog
                    tenantSlug={tenantSlug}
                    courseId={courseId}
                    sectionId={section.id}
                    lesson={lesson}
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      reorder.execute({ tenantSlug, courseId, kind: "LESSON", id: lesson.id, direction: "UP" })
                    }
                  >
                    ↑
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      reorder.execute({ tenantSlug, courseId, kind: "LESSON", id: lesson.id, direction: "DOWN" })
                    }
                  >
                    ↓
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      if (window.confirm("Delete this lesson?"))
                        remove.execute({ tenantSlug, courseId, kind: "LESSON", id: lesson.id });
                    }}
                  >
                    ✕
                  </Button>
                </div>
              </div>
            ))}
            <LessonDialog
              tenantSlug={tenantSlug}
              courseId={courseId}
              sectionId={section.id}
            />
          </CardContent>
        </Card>
      ))}
      <Button variant="outline" onClick={addSection}>
        + Add section
      </Button>
    </div>
  );
}

function LessonDialog({
  tenantSlug,
  courseId,
  sectionId,
  lesson,
}: {
  tenantSlug: string;
  courseId: string;
  sectionId: string;
  lesson?: LessonRow;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(lesson?.type ?? "VIDEO");
  const [isFreePreview, setIsFreePreview] = useState(lesson?.isFreePreview ?? false);

  const { execute, isPending } = useAction(upsertLesson, {
    onSuccess: () => {
      toast.success("Lesson saved");
      setOpen(false);
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const articleText = String(form.get("articleText") || "");
    const embedUrl = String(form.get("embedUrl") || "");
    execute({
      tenantSlug,
      courseId,
      sectionId,
      lessonId: lesson?.id,
      type: type as never,
      title: String(form.get("title")),
      isFreePreview,
      releaseAfterDays: form.get("releaseAfterDays")
        ? Number(form.get("releaseAfterDays"))
        : null,
      durationSec: form.get("durationMin") ? Number(form.get("durationMin")) * 60 : null,
      content:
        type === "ARTICLE" && articleText
          ? {
              type: "doc",
              content: articleText.split("\n").filter(Boolean).map((line) => ({
                type: "paragraph",
                content: [{ type: "text", text: line }],
              })),
            }
          : type === "EMBED" && embedUrl
            ? { embedUrl }
            : undefined,
      externalVideoUrl: String(form.get("externalVideoUrl") || ""),
      labConfig:
        type === "CODE_LAB"
          ? {
              provider: "FERMION",
              labRef: String(form.get("labRef") || "") || undefined,
            }
          : undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          lesson ? (
            <Button variant="ghost" size="icon-sm" title="Edit lesson">
              ✎
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="mt-1">
              + Add lesson
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{lesson ? "Edit lesson" : "Add lesson"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" defaultValue={lesson?.title} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v ?? "")} disabled={Boolean(lesson)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LESSON_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="durationMin">Duration (min)</Label>
              <Input
                id="durationMin"
                name="durationMin"
                type="number"
                min={0}
                defaultValue={lesson?.durationSec ? Math.round(lesson.durationSec / 60) : ""}
              />
            </div>
          </div>
          {type === "VIDEO" && (
            <div className="space-y-2">
              <Label htmlFor="externalVideoUrl">Video URL</Label>
              <Input
                id="externalVideoUrl"
                name="externalVideoUrl"
                type="url"
                placeholder="https://… (or upload via Fermion once configured)"
              />
              <p className="text-xs text-muted-foreground">
                DRM uploads via Fermion appear here once FERMION_API_KEY is set;
                an external URL works for drafts and testing.
              </p>
            </div>
          )}
          {type === "ARTICLE" && (
            <div className="space-y-2">
              <Label htmlFor="articleText">Article text</Label>
              <Textarea id="articleText" name="articleText" rows={8} />
            </div>
          )}
          {type === "CODE_LAB" && (
            <div className="space-y-2">
              <Label htmlFor="labRef">Fermion lab ID</Label>
              <Input id="labRef" name="labRef" defaultValue={lesson?.labRef ?? ""} />
            </div>
          )}
          {type === "EMBED" && (
            <div className="space-y-2">
              <Label htmlFor="embedUrl">Embed URL</Label>
              <Input id="embedUrl" name="embedUrl" type="url" />
            </div>
          )}
          <div className="grid grid-cols-2 items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="releaseAfterDays">Drip: release after (days)</Label>
              <Input
                id="releaseAfterDays"
                name="releaseAfterDays"
                type="number"
                min={0}
                defaultValue={lesson?.releaseAfterDays ?? ""}
              />
            </div>
            <div className="flex items-center gap-2 pb-1">
              <Switch checked={isFreePreview} onCheckedChange={setIsFreePreview} />
              <Label>Free preview</Label>
            </div>
          </div>
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Saving…" : "Save lesson"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
