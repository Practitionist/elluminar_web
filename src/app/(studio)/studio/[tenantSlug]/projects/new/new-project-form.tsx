"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

import { createProject } from "@/actions/projects";
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
import { Textarea } from "@/components/ui/textarea";

const slugify = (v: string) =>
  v.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 48);

export function NewProjectForm({ tenantSlug }: { tenantSlug: string }) {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [tier, setTier] = useState("CAPSTONE");

  const { execute, isPending } = useAction(createProject, {
    onSuccess: ({ data }) => {
      toast.success("Project created");
      router.push(`/studio/${tenantSlug}/projects/${data?.projectId}`);
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          execute({
            tenantSlug,
            title: String(form.get("title")),
            slug,
            tier: tier as never,
            summary: String(form.get("summary")),
            brief: String(form.get("brief")),
            techStack: String(form.get("techStack") || "")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            durationWeeksMin: Number(form.get("durationWeeksMin") || 4),
            durationWeeksMax: Number(form.get("durationWeeksMax") || 8),
          });
        }}
        className="space-y-5"
      >
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            name="title"
            required
            onChange={(e) => setSlug(slugify(e.target.value))}
            placeholder="Distributed Rate Limiter as a Service"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input id="slug" value={slug} onChange={(e) => setSlug(slugify(e.target.value))} required />
          </div>
          <div className="space-y-2">
            <Label>Tier</Label>
            <Select value={tier} onValueChange={(v) => setTier(v ?? "CAPSTONE")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CAPSTONE">Capstone (4–8 wks, checkpointed)</SelectItem>
                <SelectItem value="SPRINT" disabled>
                  Sprint (launches post-MVP)
                </SelectItem>
                <SelectItem value="FLAGSHIP" disabled>
                  Flagship (launches post-MVP)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="summary">One-paragraph summary (public)</Label>
          <Textarea id="summary" name="summary" rows={2} required minLength={20} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="brief">The brief (learners see this after purchase)</Label>
          <Textarea
            id="brief"
            name="brief"
            rows={10}
            required
            minLength={50}
            placeholder="Deliberately incomplete requirements. Real constraints. Tradeoffs they must make and justify…"
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="techStack">Tech stack (comma-sep)</Label>
            <Input id="techStack" name="techStack" placeholder="go, redis, grpc" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="durationWeeksMin">Min weeks</Label>
            <Input id="durationWeeksMin" name="durationWeeksMin" type="number" min={1} defaultValue={4} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="durationWeeksMax">Max weeks</Label>
            <Input id="durationWeeksMax" name="durationWeeksMax" type="number" min={1} defaultValue={8} />
          </div>
        </div>
        <Button type="submit" disabled={isPending} className="w-full rounded-full">
          {isPending ? "Creating…" : "Create project"}
        </Button>
      </form>
    </div>
  );
}
