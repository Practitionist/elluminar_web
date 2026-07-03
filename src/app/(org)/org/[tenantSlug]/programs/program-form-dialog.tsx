"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

import { upsertProgram } from "@/actions/program";
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
import { Textarea } from "@/components/ui/textarea";

const slugify = (v: string) =>
  v.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 48);

export function ProgramFormDialog({
  tenantSlug,
  program,
}: {
  tenantSlug: string;
  program?: {
    id: string;
    title: string;
    slug: string;
    description: string;
    coBrandPartnerName: string;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState(program?.slug ?? "");

  const { execute, isPending } = useAction(upsertProgram, {
    onSuccess({ data }) {
      toast.success("Program saved");
      setOpen(false);
      if (!program && data) router.push(`/org/${tenantSlug}/programs/${data.programId}`);
      else router.refresh();
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          program ? (
            <Button variant="outline" size="sm">
              Edit
            </Button>
          ) : (
            <Button>+ New program</Button>
          )
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{program ? "Edit program" : "New program"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            execute({
              tenantSlug,
              programId: program?.id,
              title: String(form.get("title")),
              slug,
              description: String(form.get("description") || "") || undefined,
              coBrandPartnerName: String(form.get("coBrandPartnerName") || "") || undefined,
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              defaultValue={program?.title}
              required
              onChange={(e) => {
                if (!program) setSlug(slugify(e.target.value));
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input id="slug" value={slug} onChange={(e) => setSlug(slugify(e.target.value))} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              rows={4}
              defaultValue={program?.description}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="coBrandPartnerName">Certificate co-brand partner name</Label>
            <Input
              id="coBrandPartnerName"
              name="coBrandPartnerName"
              defaultValue={program?.coBrandPartnerName}
              placeholder="Shown on program certificates alongside lms-web"
            />
          </div>
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Saving…" : "Save program"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
