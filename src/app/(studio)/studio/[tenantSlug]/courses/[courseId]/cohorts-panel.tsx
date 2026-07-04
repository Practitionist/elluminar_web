"use client";

import { Plus } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

import { upsertCohort } from "@/actions/course";
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

type CohortRow = {
  id: string;
  name: string;
  slug: string;
  startsAt: string;
  endsAt: string | null;
  capacity: number | null;
  status: string;
  seatPriceRupees: number | null;
};

const STATUS_TONE: Record<string, PillTone> = {
  DRAFT: "neutral",
  OPEN: "success",
  RUNNING: "info",
  COMPLETED: "neutral",
  CANCELLED: "destructive",
};

const slugify = (v: string) =>
  v.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 48);

export function CohortsPanel({
  tenantSlug,
  courseId,
  cohorts,
}: {
  tenantSlug: string;
  courseId: string;
  cohorts: CohortRow[];
}) {
  return (
    <div className="space-y-4">
      {cohorts.map((c) => (
        <div key={c.id} className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="text-base font-extrabold">{c.name}</div>
            <div className="flex items-center gap-2">
              <Pill tone={STATUS_TONE[c.status] ?? "neutral"}>{c.status.toLowerCase()}</Pill>
              <CohortDialog tenantSlug={tenantSlug} courseId={courseId} cohort={c} />
            </div>
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            {new Date(c.startsAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
            {c.endsAt
              ? ` → ${new Date(c.endsAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}`
              : ""}
            {c.capacity ? ` · ${c.capacity} seats` : ""}
            {c.seatPriceRupees != null ? ` · ₹${c.seatPriceRupees.toLocaleString("en-IN")}` : ""}
          </div>
        </div>
      ))}
      <CohortDialog tenantSlug={tenantSlug} courseId={courseId} />
    </div>
  );
}

function CohortDialog({
  tenantSlug,
  courseId,
  cohort,
}: {
  tenantSlug: string;
  courseId: string;
  cohort?: CohortRow;
}) {
  const [open, setOpen] = useState(false);
  const { execute, isPending } = useAction(upsertCohort, {
    onSuccess: () => {
      toast.success("Cohort saved");
      setOpen(false);
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name"));
    execute({
      tenantSlug,
      courseId,
      cohortId: cohort?.id,
      name,
      slug: cohort?.slug ?? slugify(name),
      startsAt: new Date(String(form.get("startsAt"))),
      endsAt: form.get("endsAt") ? new Date(String(form.get("endsAt"))) : null,
      enrollmentClosesAt: null,
      capacity: form.get("capacity") ? Number(form.get("capacity")) : null,
      seatPriceRupees: form.get("seatPriceRupees")
        ? Number(form.get("seatPriceRupees"))
        : null,
    });
  }

  const toLocalDate = (iso?: string | null) => (iso ? iso.slice(0, 10) : "");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          cohort ? (
            <Button variant="outline" size="sm" className="rounded-full">
              Edit
            </Button>
          ) : (
            <Button variant="outline" className="rounded-full">
              <Plus className="size-3.5" />
              Schedule cohort
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{cohort ? "Edit cohort" : "Schedule a cohort"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={cohort?.name} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startsAt">Starts</Label>
              <Input
                id="startsAt"
                name="startsAt"
                type="date"
                defaultValue={toLocalDate(cohort?.startsAt)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endsAt">Ends</Label>
              <Input
                id="endsAt"
                name="endsAt"
                type="date"
                defaultValue={toLocalDate(cohort?.endsAt)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="capacity">Capacity</Label>
              <Input
                id="capacity"
                name="capacity"
                type="number"
                min={1}
                defaultValue={cohort?.capacity ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seatPriceRupees">Seat price (₹)</Label>
              <Input
                id="seatPriceRupees"
                name="seatPriceRupees"
                type="number"
                min={0}
                defaultValue={cohort?.seatPriceRupees ?? ""}
              />
            </div>
          </div>
          <Button type="submit" disabled={isPending} className="w-full rounded-full">
            {isPending ? "Saving…" : "Save cohort"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
