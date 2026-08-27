"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

import { submitMilestone } from "@/actions/project-work";
import { finalizeSubmissionUpload, requestMilestoneUpload } from "@/actions/submissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_SUBMISSION_FILES,
  MAX_UPLOAD_BYTES,
  SUBMISSION_ACCEPT_ATTR,
  mimeForFilename,
} from "@/lib/learning/uploads";

export function MilestoneSubmitForm({
  projectInstanceId,
  milestoneId,
  storageReady,
}: {
  projectInstanceId: string;
  milestoneId: string;
  storageReady: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<Array<{ assetId: string; filename: string }>>([]);
  const [uploading, setUploading] = useState(false);

  const { execute, isPending } = useAction(submitMilestone, {
    onSuccess: () => {
      toast.success("Submitted for mentor review");
      setOpen(false);
      setFiles([]);
      router.refresh();
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Submission failed"),
  });

  async function onPick(picked: FileList | null) {
    if (!picked?.length) return;
    setUploading(true);
    for (const file of Array.from(picked)) {
      if (files.length >= MAX_SUBMISSION_FILES) {
        toast.error(`Up to ${MAX_SUBMISSION_FILES} files.`);
        break;
      }
      const mime = mimeForFilename(file.name, file.type);
      if (!mime) {
        toast.error(`${file.name}: unsupported file type.`);
        continue;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        toast.error(`${file.name} is over 25 MB.`);
        continue;
      }
      try {
        const presign = await requestMilestoneUpload({
          projectInstanceId,
          filename: file.name,
          mime,
          sizeBytes: file.size,
        });
        if (presign?.serverError || !presign?.data) {
          toast.error(presign?.serverError ?? `Couldn't start upload for ${file.name}.`);
          continue;
        }
        const put = await fetch(presign.data.uploadUrl, { method: "PUT", body: file });
        if (!put.ok) {
          toast.error(`Upload failed for ${file.name}.`);
          continue;
        }
        const fin = await finalizeSubmissionUpload({ assetId: presign.data.assetId });
        if (fin?.serverError) {
          toast.error(fin.serverError);
          continue;
        }
        setFiles((prev) => [...prev, { assetId: presign.data!.assetId, filename: file.name }]);
      } catch {
        toast.error(`Upload failed for ${file.name}.`);
      }
    }
    setUploading(false);
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="rounded-full" onClick={() => setOpen(true)}>
        Submit this milestone
      </Button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        execute({
          projectInstanceId,
          milestoneId,
          notes: String(form.get("notes") || "") || undefined,
          repoUrl: String(form.get("repoUrl") || ""),
          artifactUrl: String(form.get("artifactUrl") || ""),
          mediaAssetIds: files.length > 0 ? files.map((f) => f.assetId) : undefined,
        });
      }}
      className="space-y-3 rounded-xl border border-border bg-muted/30 p-4"
    >
      <Input name="repoUrl" type="url" placeholder="Repository URL" />
      <Input name="artifactUrl" type="url" placeholder="Demo / artifact URL (optional)" />
      <Textarea
        name="notes"
        rows={3}
        placeholder="What you built, decisions you made, what to look at first…"
      />

      {storageReady && (
        <div className="space-y-2">
          <Label htmlFor={`files-${milestoneId}`} className="text-xs">
            Attach files — decks, documents, spreadsheets, PDFs or images (max 25 MB each, up to{" "}
            {MAX_SUBMISSION_FILES})
          </Label>
          <Input
            id={`files-${milestoneId}`}
            type="file"
            multiple
            accept={SUBMISSION_ACCEPT_ATTR}
            disabled={uploading || files.length >= MAX_SUBMISSION_FILES}
            onChange={(e) => {
              void onPick(e.target.files);
              e.target.value = "";
            }}
          />
          {files.length > 0 && (
            <ul className="space-y-1">
              {files.map((f) => (
                <li
                  key={f.assetId}
                  className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-1.5 text-xs"
                >
                  <span className="truncate">{f.filename}</span>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      setFiles((prev) => prev.filter((x) => x.assetId !== f.assetId))
                    }
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          className="rounded-full"
          disabled={isPending || uploading}
        >
          {uploading ? "Uploading…" : isPending ? "Submitting…" : "Submit for review"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
