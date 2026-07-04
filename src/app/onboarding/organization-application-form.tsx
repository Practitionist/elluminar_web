"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

import { applyAsOrganization } from "@/actions/enterprise-tenant";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const slugify = (v: string) =>
  v.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 48);

const TYPES = [
  {
    value: "CREATOR",
    title: "Creator / School",
    blurb: "Teach courses and mentor-guided projects on the marketplace.",
  },
  {
    value: "ENTERPRISE",
    title: "Company",
    blurb: "Upskill your team with seat licenses, credit pools, and reporting.",
  },
  {
    value: "UNIVERSITY",
    title: "University",
    blurb: "Run co-branded certificate programs with cohorts and rosters.",
  },
] as const;

export function OrganizationApplicationForm() {
  const router = useRouter();
  const [type, setType] = useState<(typeof TYPES)[number]["value"]>("CREATOR");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const { execute, isPending } = useAction(applyAsOrganization, {
    onSuccess({ data }) {
      toast.success("Application submitted — it's now under review.");
      router.push(
        data?.type === "CREATOR" ? `/studio/${data?.tenantSlug}` : `/org/${data?.tenantSlug}`,
      );
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Could not submit"),
  });

  return (
    <Card className="rounded-3xl border border-border ring-0 [--card-spacing:--spacing(6)]">
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            execute({
              name: String(form.get("name")),
              slug,
              type,
              about: String(form.get("about") || "") || undefined,
              supportEmail: String(form.get("supportEmail") || ""),
            });
          }}
          className="space-y-5"
        >
          <div className="space-y-2">
            <Label>What are you?</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={cn(
                    "rounded-2xl border p-3 text-left text-sm transition-colors",
                    type === t.value
                      ? "border-primary bg-primary-subtle"
                      : "border-border hover:bg-muted/50",
                  )}
                >
                  <div
                    className={cn(
                      "font-bold",
                      type === t.value
                        ? "text-primary-subtle-foreground"
                        : "text-foreground",
                    )}
                  >
                    {t.title}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{t.blurb}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">
              {type === "CREATOR" ? "School / brand name" : "Organization name"}
            </Label>
            <Input
              id="name"
              name="name"
              required
              onChange={(e) => {
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Handle</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                lms-web.com/c/
              </span>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(slugify(e.target.value));
                }}
                required
                className="flex-1 font-mono"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="about">
              {type === "CREATOR"
                ? "What do you teach?"
                : type === "ENTERPRISE"
                  ? "What does your team need?"
                  : "Which programs are you exploring?"}
            </Label>
            <Textarea id="about" name="about" rows={4} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="supportEmail">Contact email (optional)</Label>
            <Input id="supportEmail" name="supportEmail" type="email" />
          </div>
          <Button type="submit" disabled={isPending} className="w-full rounded-full">
            {isPending ? "Submitting…" : "Submit application"}
          </Button>
          <p className="text-xs text-muted-foreground">
            {type === "CREATOR"
              ? "You can author content immediately; publishing unlocks on approval."
              : "Enterprise deals are usually sales-assisted — applying here fast-tracks the conversation."}
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
