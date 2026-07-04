"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useEffect, useRef } from "react";

import { markLessonProgress } from "@/actions/learning";

type Playback =
  | { kind: "external"; url: string | null }
  | { kind: "fermion"; data: Record<string, unknown> }
  | { kind: "pending" };

export function VideoLessonPlayer({
  courseId,
  lessonId,
  playback,
  resumeAt,
}: {
  courseId: string;
  lessonId: string;
  playback: Playback;
  resumeAt: number;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSaved = useRef(0);

  const { execute } = useAction(markLessonProgress, {
    onSuccess: ({ input }) => {
      if ((input as { status?: string }).status === "COMPLETED") router.refresh();
    },
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (resumeAt > 0) video.currentTime = resumeAt;

    const onTimeUpdate = () => {
      const pos = Math.floor(video.currentTime);
      if (pos - lastSaved.current >= 15) {
        lastSaved.current = pos;
        execute({
          courseId,
          lessonId,
          status: "IN_PROGRESS",
          secondsWatched: pos,
          lastPositionSec: pos,
        });
      }
    };
    const onEnded = () => {
      execute({
        courseId,
        lessonId,
        status: "COMPLETED",
        secondsWatched: Math.floor(video.duration || 0),
        lastPositionSec: 0,
      });
    };
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("ended", onEnded);
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("ended", onEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, lessonId, resumeAt]);

  if (playback.kind === "external" && playback.url) {
    return (
      <video
        ref={videoRef}
        src={playback.url}
        controls
        controlsList="nodownload"
        className="aspect-video w-full rounded-2xl border border-border bg-black"
      />
    );
  }

  if (playback.kind === "fermion") {
    const url =
      (playback.data.playbackUrl as string | undefined) ??
      (playback.data.m3u8Url as string | undefined);
    if (url) {
      // Native HLS works in Safari; the DRM-grade embedded player lands with
      // the Fermion account setup (playbackMeta carries the signed data).
      return (
        <video
          ref={videoRef}
          src={url}
          controls
          controlsList="nodownload"
          className="aspect-video w-full rounded-2xl border border-border bg-black"
        />
      );
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card px-6 py-16 text-center text-sm text-muted-foreground">
      {playback.kind === "pending"
        ? "This video is still processing — check back shortly."
        : "Video source unavailable."}
    </div>
  );
}
