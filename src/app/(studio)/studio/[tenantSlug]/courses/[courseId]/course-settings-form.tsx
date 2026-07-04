"use client";

import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

import { updateCourseSettings } from "@/actions/course";
import { Button } from "@/components/ui/button";
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

export function CourseSettingsForm({
  tenantSlug,
  courseId,
  categories,
  defaults,
}: {
  tenantSlug: string;
  courseId: string;
  categories: Array<{ id: string; name: string }>;
  defaults: {
    title: string;
    subtitle: string;
    level: string;
    categoryId: string;
    tags: string;
    outcomes: string;
    prerequisites: string;
    visibility: string;
    selfPacedEnabled: boolean;
    liveEnabled: boolean;
    estimatedHours: number | null;
    certificateEnabled: boolean;
  };
}) {
  const [level, setLevel] = useState(defaults.level);
  const [categoryId, setCategoryId] = useState(defaults.categoryId);
  const [visibility, setVisibility] = useState(defaults.visibility);
  const [selfPaced, setSelfPaced] = useState(defaults.selfPacedEnabled);
  const [live, setLive] = useState(defaults.liveEnabled);
  const [certificate, setCertificate] = useState(defaults.certificateEnabled);

  const { execute, isPending } = useAction(updateCourseSettings, {
    onSuccess: () => toast.success("Settings saved"),
    onError: ({ error }) => toast.error(error.serverError ?? "Save failed"),
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const splitLines = (v: string) =>
      v.split("\n").map((s) => s.trim()).filter(Boolean);
    execute({
      tenantSlug,
      courseId,
      title: String(form.get("title")),
      subtitle: String(form.get("subtitle") || "") || undefined,
      level: level as never,
      categoryId: categoryId || null,
      tags: String(form.get("tags") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      outcomes: splitLines(String(form.get("outcomes") || "")),
      prerequisites: splitLines(String(form.get("prerequisites") || "")),
      language: "en",
      visibility: visibility as never,
      selfPacedEnabled: selfPaced,
      liveEnabled: live,
      estimatedHours: form.get("estimatedHours")
        ? Number(form.get("estimatedHours"))
        : null,
      certificateEnabled: certificate,
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <form onSubmit={onSubmit} className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" defaultValue={defaults.title} required />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="subtitle">Subtitle</Label>
          <Input id="subtitle" name="subtitle" defaultValue={defaults.subtitle} />
        </div>
        <div className="space-y-2">
          <Label>Level</Label>
          <Select value={level} onValueChange={(v) => setLevel(v ?? "")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BEGINNER">Beginner</SelectItem>
              <SelectItem value="INTERMEDIATE">Intermediate</SelectItem>
              <SelectItem value="ADVANCED">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "")}>
            <SelectTrigger>
              <SelectValue placeholder="Pick one" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tags">Tags (comma-separated)</Label>
          <Input id="tags" name="tags" defaultValue={defaults.tags} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="estimatedHours">Estimated hours</Label>
          <Input
            id="estimatedHours"
            name="estimatedHours"
            type="number"
            min={0}
            step="0.5"
            defaultValue={defaults.estimatedHours ?? ""}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="outcomes">Outcomes (one per line)</Label>
          <Textarea id="outcomes" name="outcomes" rows={4} defaultValue={defaults.outcomes} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="prerequisites">Prerequisites (one per line)</Label>
          <Textarea
            id="prerequisites"
            name="prerequisites"
            rows={3}
            defaultValue={defaults.prerequisites}
          />
        </div>
        <div className="space-y-2">
          <Label>Visibility</Label>
          <Select value={visibility} onValueChange={(v) => setVisibility(v ?? "")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MARKETPLACE">Marketplace + storefront</SelectItem>
              <SelectItem value="TENANT_ONLY">Storefront only</SelectItem>
              <SelectItem value="PRIVATE">Private (link/roster only)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col justify-end gap-3">
          <div className="flex items-center gap-2">
            <Switch checked={selfPaced} onCheckedChange={setSelfPaced} />
            <Label>Self-paced enabled</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={live} onCheckedChange={setLive} />
            <Label>Live cohorts enabled</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={certificate} onCheckedChange={setCertificate} />
            <Label>Completion certificate</Label>
          </div>
        </div>
        <div className="md:col-span-2">
          <Button type="submit" disabled={isPending} className="rounded-full">
            {isPending ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </form>
    </div>
  );
}
