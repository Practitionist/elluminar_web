"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

import { createCourse } from "@/actions/course";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const slugify = (v: string) =>
  v.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 48);

export function NewCourseForm({
  tenantSlug,
  categories,
}: {
  tenantSlug: string;
  categories: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [level, setLevel] = useState("BEGINNER");
  const [categoryId, setCategoryId] = useState<string>("");

  const { execute, isPending } = useAction(createCourse, {
    onSuccess: ({ data }) => {
      toast.success("Course created");
      router.push(`/studio/${tenantSlug}/courses/${data?.courseId}`);
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Failed to create course"),
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    execute({
      tenantSlug,
      title: String(form.get("title")),
      slug,
      subtitle: String(form.get("subtitle") || "") || undefined,
      level: level as "BEGINNER" | "INTERMEDIATE" | "ADVANCED",
      categoryId: categoryId || undefined,
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              required
              onChange={(e) => setSlug(slugify(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subtitle">Subtitle</Label>
            <Input id="subtitle" name="subtitle" />
          </div>
          <div className="grid grid-cols-2 gap-4">
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
          </div>
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Creating…" : "Create course"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
