"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

import { finalizeSubmissionUpload, requestSubmissionUpload } from "@/actions/submissions";
import { submitAssignment } from "@/actions/learning";
import { Pill, type PillTone } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const SUBMISSION_STATUS_TONE: Record<string, PillTone> = {
  DRAFT: "neutral",
  SUBMITTED: "info",
  GRADING: "info",
  GRADED: "success",
  RETURNED: "neutral",
  RESUBMIT_REQUESTED: "distinction",
};

const MAX_FILES = 5;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.zip";

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  zip: "application/zip",
};

function mimeForFile(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "";
}

export function AssignmentPanel({
  courseId,
  lessonId,
  assignment,
  submissions,
  dueAt,
  nowIso,
  storageReady,
}: {
  courseId: string;
  lessonId: string;
  assignment: {
    title: string;
    instructions: string;
    maxPoints: number;
    submissionKinds: string[];
    allowResubmission: boolean;
    allowLate: boolean;
  };
  submissions: Array<{
    id: string;
    attemptNo: number;
    status: string;
    scorePoints: number | null;
    maxPoints: number;
    feedback: string | null;
    submittedAt: string | null;
    late: boolean;
  }>;
  /** ISO due date derived from enrollment activation, or null when open-ended. */
  dueAt: string | null;
  /** Server clock snapshot at page render (ISO) — pure deadline comparison. */
  nowIso: string;
  storageReady: boolean;
}) {
  const router = useRouter();
  const [files, setFiles] = useState<Array<{ assetId: string; filename: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const { execute, isPending } = useAction(submitAssignment, {
    onSuccess: () => {
      setFiles([]);
      toast.success("Submitted — your instructor will review it.");
      router.refresh();
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Submission failed"),
  });

  const latest = submissions[0];
  const canSubmit =
    !latest ||
    (assignment.allowResubmission &&
      (latest.status === "GRADED" || latest.status === "RESUBMIT_REQUESTED"));

  const dueDate = dueAt ? new Date(dueAt) : null;
  // Compare against a server-rendered clock snapshot: keeps render pure
  // (no Date.now()) while still reflecting real elapsed time per page load.
  const pastDue = dueDate ? new Date(nowIso).getTime() > dueDate.getTime() : false;
  const closed = pastDue && !assignment.allowLate;

  async function onFilesPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (picked.length === 0) return;
    const room = MAX_FILES - files.length;
    if (picked.length > room) {
      toast.error(`You can attach up to ${MAX_FILES} files.`);
    }
    setUploading(true);
    for (const file of picked.slice(0, room)) {
      const mime = mimeForFile(file);
      if (!mime) {
        toast.error(`${file.name}: use PDF, PNG, JPG, WEBP or ZIP.`);
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        toast.error(`${file.name} is over 25 MB.`);
        continue;
      }
      try {
        const presign = await requestSubmissionUpload({
          courseId,
          lessonId,
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

  function removeFile(assetId: string) {
    setFiles((prev) => prev.filter((f) => f.assetId !== assetId));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (closed) return;
    const form = new FormData(e.currentTarget);
    execute({
      courseId,
      lessonId,
      text: String(form.get("text") || "") || undefined,
      repoUrl: String(form.get("repoUrl") || ""),
      url: String(form.get("url") || ""),
      mediaAssetIds: files.length > 0 ? files.map((f) => f.assetId) : undefined,
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-base font-extrabold">{assignment.title}</h2>
        <p className="mt-3 text-sm whitespace-pre-line">{assignment.instructions}</p>
        <p className="mt-3 text-xs font-semibold text-muted-foreground">
          Worth {assignment.maxPoints} points · instructor-reviewed
          {dueDate
            ? ` · due ${dueDate.toLocaleDateString("en-IN", { dateStyle: "medium" })}`
            : ""}
        </p>
        {pastDue && (
          <p className="mt-2 text-xs font-semibold">
            {closed ? (
              <span className="text-destructive">Deadline passed — submissions are closed.</span>
            ) : (
              <span className="text-distinction-subtle-foreground">
                Deadline passed — you can still submit, but it will be marked late.
              </span>
            )}
          </p>
        )}
      </div>

      {submissions.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-base font-extrabold">Your submissions</h2>
          <div className="mt-3 space-y-2">
            {submissions.map((s) => (
              <div key={s.id} className="rounded-lg border border-border px-3 py-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Attempt {s.attemptNo}</span>
                  <div className="flex items-center gap-2">
                    {s.late && <Pill tone="distinction">late</Pill>}
                    {s.scorePoints != null && (
                      <span className="font-bold tabular-nums">
                        {s.scorePoints}/{s.maxPoints}
                      </span>
                    )}
                    <Pill tone={SUBMISSION_STATUS_TONE[s.status] ?? "neutral"}>
                      {s.status.toLowerCase().replace(/_/g, " ")}
                    </Pill>
                  </div>
                </div>
                {s.feedback && (
                  <p className="mt-1.5 text-xs text-muted-foreground">“{s.feedback}”</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {canSubmit && !closed && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-base font-extrabold">
            {latest ? "Resubmit your work" : "Submit your work"}
          </h2>
          <form onSubmit={onSubmit} className="mt-4 space-y-4">
            {assignment.submissionKinds.includes("TEXT") && (
              <div className="space-y-2">
                <Label htmlFor="text">Answer</Label>
                <Textarea id="text" name="text" rows={6} />
              </div>
            )}
            {assignment.submissionKinds.includes("FILE") && (
              <div className="space-y-2">
                <Label htmlFor="submission-files">Files</Label>
                <Input
                  id="submission-files"
                  type="file"
                  accept={ACCEPT}
                  multiple
                  disabled={!storageReady || uploading || files.length >= MAX_FILES}
                  onChange={onFilesPicked}
                />
                {!storageReady && (
                  <p className="text-xs text-muted-foreground">
                    File uploads aren&apos;t configured for this environment yet.
                  </p>
                )}
                {files.length > 0 && (
                  <ul className="space-y-1">
                    {files.map((f) => (
                      <li
                        key={f.assetId}
                        className="flex items-center justify-between rounded-lg border border-border px-3 py-1.5 text-sm"
                      >
                        <span className="truncate">{f.filename}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(f.assetId)}
                        >
                          Remove
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-muted-foreground">
                  Up to {MAX_FILES} files · PDF, PNG, JPG, WEBP or ZIP · max 25 MB each
                </p>
              </div>
            )}
            {assignment.submissionKinds.includes("REPO_URL") && (
              <div className="space-y-2">
                <Label htmlFor="repoUrl">Repository URL</Label>
                <Input id="repoUrl" name="repoUrl" type="url" placeholder="https://github.com/…" />
              </div>
            )}
            {assignment.submissionKinds.includes("URL") && (
              <div className="space-y-2">
                <Label htmlFor="url">Link</Label>
                <Input id="url" name="url" type="url" />
              </div>
            )}
            <Button type="submit" disabled={isPending || uploading} className="rounded-full">
              {isPending ? "Submitting…" : uploading ? "Uploading…" : "Submit"}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
