"use client";

import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

import { createLicense } from "@/actions/license";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

type Kind = "CATALOG" | "PROGRAM" | "CREDIT_POOL";

export function CreateLicenseDialog({
  tenantSlug,
  programs,
  courses,
}: {
  tenantSlug: string;
  programs: Array<{ id: string; title: string }>;
  courses: Array<{ id: string; title: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("CATALOG");
  const [programId, setProgramId] = useState("");
  const [courseIds, setCourseIds] = useState<string[]>([]);

  const { execute, isPending } = useAction(createLicense, {
    onSuccess: () => {
      toast.success("License created (draft) — it activates on contract payment.");
      setOpen(false);
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Failed"),
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const base = {
      tenantSlug,
      startsAt: new Date(String(form.get("startsAt"))),
      endsAt: new Date(String(form.get("endsAt"))),
      contractRef: String(form.get("contractRef") || "") || undefined,
      notes: undefined,
    };
    if (kind === "CATALOG") {
      execute({
        ...base,
        kind,
        seats: Number(form.get("seats") || 1),
        contractValueRupees: form.get("contractValue")
          ? Number(form.get("contractValue"))
          : undefined,
        catalogCourseIds: courseIds,
      });
    } else if (kind === "PROGRAM") {
      if (!programId) {
        toast.error("Pick a program");
        return;
      }
      execute({
        ...base,
        kind,
        seats: Number(form.get("seats") || 1),
        programId,
        contractValueRupees: form.get("contractValue")
          ? Number(form.get("contractValue"))
          : undefined,
      });
    } else {
      execute({
        ...base,
        kind,
        contractValueRupees: Number(form.get("contractValue") || 0),
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>+ New license</Button>} />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a license</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Kind</Label>
            <Select value={kind} onValueChange={(v) => setKind((v as Kind) ?? "CATALOG")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CATALOG">Catalog seats (named users, course allowlist)</SelectItem>
                <SelectItem value="PROGRAM">Program seats (cohort places)</SelectItem>
                <SelectItem value="CREDIT_POOL">Credit pool (prepaid ₹, redeem anything)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startsAt">Starts</Label>
              <Input id="startsAt" name="startsAt" type="date" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endsAt">Ends</Label>
              <Input id="endsAt" name="endsAt" type="date" required />
            </div>
          </div>

          {kind !== "CREDIT_POOL" && (
            <div className="space-y-2">
              <Label htmlFor="seats">Seats</Label>
              <Input id="seats" name="seats" type="number" min={1} defaultValue={25} required />
            </div>
          )}

          {kind === "PROGRAM" && (
            <div className="space-y-2">
              <Label>Program</Label>
              <Select value={programId} onValueChange={(v) => setProgramId(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a program" />
                </SelectTrigger>
                <SelectContent>
                  {programs.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {kind === "CATALOG" && (
            <div className="space-y-2">
              <Label>Catalog scope (leave empty = full marketplace catalog)</Label>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                {courses.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={courseIds.includes(c.id)}
                      onCheckedChange={(checked) =>
                        setCourseIds((prev) =>
                          checked ? [...prev, c.id] : prev.filter((id) => id !== c.id),
                        )
                      }
                    />
                    {c.title}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contractValue">
                Contract value (₹){kind === "CREDIT_POOL" ? " — the pool" : ""}
              </Label>
              <Input
                id="contractValue"
                name="contractValue"
                type="number"
                min={0}
                required={kind === "CREDIT_POOL"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contractRef">Contract ref</Label>
              <Input id="contractRef" name="contractRef" placeholder="PO / agreement #" />
            </div>
          </div>

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Creating…" : "Create license (draft)"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
