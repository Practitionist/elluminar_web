"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

import { applyAsCreator } from "@/actions/tenant";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const slugify = (v: string) =>
  v
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48);

export function CreatorApplicationForm() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const { execute, isPending } = useAction(applyAsCreator, {
    onSuccess({ data }) {
      toast.success("Application submitted — your school is under review.");
      router.push(`/studio/${data?.tenantSlug}`);
    },
    onError({ error }) {
      toast.error(error.serverError ?? "Could not submit application");
    },
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    execute({
      name: String(form.get("name")),
      slug: String(form.get("slug")),
      about: String(form.get("about") || ""),
      supportEmail: String(form.get("supportEmail") || ""),
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">School / brand name</Label>
            <Input
              id="name"
              name="name"
              required
              placeholder="Systems Academy"
              onChange={(e) => {
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Storefront handle</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">lms-web.com/c/</span>
              <Input
                id="slug"
                name="slug"
                required
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(slugify(e.target.value));
                }}
                className="flex-1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="about">What do you teach?</Label>
            <Textarea
              id="about"
              name="about"
              rows={4}
              placeholder="Backend engineering with real distributed-systems projects…"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="supportEmail">Support email (optional)</Label>
            <Input id="supportEmail" name="supportEmail" type="email" />
          </div>
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Submitting…" : "Submit application"}
          </Button>
          <p className="text-xs text-muted-foreground">
            You can author content immediately; publishing to the marketplace
            unlocks once your application is approved.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
