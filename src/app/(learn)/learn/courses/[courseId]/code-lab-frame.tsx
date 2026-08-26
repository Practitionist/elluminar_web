"use client";

import { Code2, ExternalLink } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { launchCodeLab } from "@/actions/labs";
import { Button } from "@/components/ui/button";

type LabRunFinishedEvent = {
  eventType: "fermion-lab-run-finished";
  data:
    | {
        status: "ok";
        totalChallengesCount: number;
        passedChallengesCount: number;
      }
    | { status: "error"; errorMessage: string };
};

/**
 * Embedded Fermion coding lab. The iframe src (JWT-signed embed URL) is
 * minted server-side per launch; run results arrive optimistically via
 * window.postMessage (origin-checked against the school hostname) and are
 * confirmed server-side by the lab-run-tests webhook.
 */
export function CodeLabFrame({
  courseId,
  lessonId,
  labRef,
  expectedOrigin,
}: {
  courseId: string;
  lessonId: string;
  labRef: string | null;
  /** e.g. "https://elluminar.fermion.app" — empty when labs aren't configured. */
  expectedOrigin: string;
}) {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<string | null>(null);

  const { execute, isPending } = useAction(launchCodeLab, {
    onSuccess: ({ data }) => {
      if (!data) return;
      if (data.status === "ok") setEmbedUrl(data.embedUrl);
      else if (data.status === "unconfigured")
        toast.error("Labs are not configured yet — check back soon.");
      else toast.error("This lesson has no lab attached.");
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Failed to launch lab."),
  });

  // Optimistic run results straight from the embedded lab (docs-recommended
  // postMessage channel). Server truth lands via the lab-run-tests webhook.
  useEffect(() => {
    if (!embedUrl) return;
    function onMessage(event: MessageEvent) {
      if (expectedOrigin && event.origin !== expectedOrigin) return;
      const payload = event.data as LabRunFinishedEvent | null | undefined;
      if (
        payload == null ||
        typeof payload !== "object" ||
        payload.eventType !== "fermion-lab-run-finished"
      ) {
        return;
      }
      if (payload.data.status === "ok") {
        setRunResult(
          payload.data.passedChallengesCount === payload.data.totalChallengesCount
            ? `All ${payload.data.totalChallengesCount} challenges passed 🎉`
            : `${payload.data.passedChallengesCount}/${payload.data.totalChallengesCount} challenges passing`,
        );
      } else {
        setRunResult(`Run error: ${payload.data.errorMessage}`);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [embedUrl, expectedOrigin]);

  if (embedUrl) {
    return (
      <div className="space-y-3">
        {runResult && (
          <div className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold">
            {runResult}
          </div>
        )}
        <div className="aspect-video w-full overflow-hidden rounded-2xl border border-border bg-black [&_iframe]:h-full [&_iframe]:w-full">
          <iframe
            src={embedUrl}
            title="Coding lab"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card px-6 py-14 text-center">
      <Code2 className="mx-auto size-6 text-muted-foreground/60" />
      <p className="text-sm text-muted-foreground">
        Interactive code lab{labRef ? ` (${labRef})` : ""} — runs in your browser.
      </p>
      <Button onClick={() => execute({ courseId, lessonId })} disabled={isPending} className="rounded-full">
        {isPending ? "Preparing lab…" : "Launch code lab"}
        <ExternalLink className="size-3.5" />
      </Button>
    </div>
  );
}
