"use client";

import { ChevronDown, ChevronUp, Pencil, Plus, X } from "lucide-react";
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
import { Pill, type PillTone } from "@/components/shared";
import { Button } from "@/components/ui/button";
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

const VIDEO_STATUS_TONE: Record<string, PillTone> = {
  READY: "success",
  FAILED: "destructive",
  DELETED: "destructive",
  PROCESSING: "distinction",
  UPLOADING: "distinction",
  UPLOAD_PENDING: "distinction",
};

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
        <div
          key={section.id}
          className="rounded-2xl border border-border bg-card p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-base font-extrabold">{section.title}</div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                title="Move up"
                onClick={() =>
                  reorder.execute({ tenantSlug, courseId, kind: "SECTION", id: section.id, direction: "UP" })
                }
              >
                <ChevronUp />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                title="Move down"
                onClick={() =>
                  reorder.execute({ tenantSlug, courseId, kind: "SECTION", id: section.id, direction: "DOWN" })
                }
              >
                <ChevronDown />
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
                <Pencil />
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
                <X />
              </Button>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {section.lessons.map((lesson) => (
              <div
                key={lesson.id}
                className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Pill tone="neutral" className="shrink-0">
                    {lesson.type.toLowerCase().replace("_", " ")}
                  </Pill>
                  <span className="truncate text-sm font-semibold">{lesson.title}</span>
                  {lesson.isFreePreview && (
                    <Pill tone="primary" className="shrink-0">
                      preview
                    </Pill>
                  )}
                  {lesson.type === "VIDEO" && lesson.videoStatus && (
                    <Pill
                      tone={VIDEO_STATUS_TONE[lesson.videoStatus] ?? "neutral"}
                      className="shrink-0"
                    >
                      {lesson.videoStatus.toLowerCase().replace("_", " ")}
                    </Pill>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {lesson.type === "QUIZ" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full"
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
                      className="rounded-full"
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
                    <ChevronUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      reorder.execute({ tenantSlug, courseId, kind: "LESSON", id: lesson.id, direction: "DOWN" })
                    }
                  >
                    <ChevronDown />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      if (window.confirm("Delete this lesson?"))
                        remove.execute({ tenantSlug, courseId, kind: "LESSON", id: lesson.id });
                    }}
                  >
                    <X />
                  </Button>
                </div>
              </div>
            ))}
            <LessonDialog
              tenantSlug={tenantSlug}
              courseId={courseId}
              sectionId={section.id}
            />
          </div>
        </div>
      ))}
      <Button variant="outline" onClick={addSection} className="rounded-full">
        <Plus className="size-3.5" />
        Add section
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
              <Pencil />
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="mt-1 rounded-full">
              <Plus className="size-3.5" />
              Add lesson
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
          <Button type="submit" disabled={isPending} className="w-full rounded-full">
            {isPending ? "Saving…" : "Save lesson"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
