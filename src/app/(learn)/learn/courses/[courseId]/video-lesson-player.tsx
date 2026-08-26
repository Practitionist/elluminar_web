"use client";

import { FermionRecordedVideo } from "@fermion-app/sdk/recorded-video";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { useEffect, useRef } from "react";

import { markLessonProgress } from "@/actions/learning";

type Playback =
  | { kind: "external"; url: string | null }
  | { kind: "fermion"; videoId: string; jwtToken: string; websiteHostname: string }
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
  const embedRef = useRef<HTMLDivElement>(null);
  const lastSaved = useRef(0);

  const { execute } = useAction(markLessonProgress, {
    onSuccess: ({ input }) => {
      if ((input as { status?: string }).status === "COMPLETED") router.refresh();
    },
  });

  // External videos: native <video> element (dev/testing path).
  useEffect(() => {
    if (playback.kind !== "external") return;
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
  }, [courseId, lessonId, resumeAt, playback.kind]);

  // Fermion videos: official SDK private embed — the only DRM-capable
  // playback path. Progress arrives over postMessage from the iframe.
  const embedKey = playback.kind === "fermion" ? playback.jwtToken : "";
  useEffect(() => {
    if (playback.kind !== "fermion" || !embedRef.current) return;
    const container = embedRef.current;
    container.innerHTML = "";

    const video = new FermionRecordedVideo({
      videoId: playback.videoId,
      websiteHostname: playback.websiteHostname,
    });
    const embed = video.getPrivateEmbedPlaybackIframeCode({
      jwtToken: playback.jwtToken,
    });
    container.innerHTML = embed.iframeHtml;

    const events = video.setupEventListenersOnVideo();
    events.onTimeUpdated(({ currentTimeInSeconds }) => {
      const pos = Math.floor(currentTimeInSeconds);
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
    });
    events.onVideoEnded(() => {
      execute({
        courseId,
        lessonId,
        status: "COMPLETED",
        secondsWatched: lastSaved.current,
        lastPositionSec: 0,
      });
    });

    return () => {
      events.dispose();
      container.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, lessonId, embedKey]);

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
    return (
      <div className="aspect-video w-full overflow-hidden rounded-2xl border border-border bg-black">
        <div
          ref={embedRef}
          className="h-full w-full [&_iframe]:h-full [&_iframe]:w-full [&_iframe]:border-0"
        />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card px-6 py-16 text-center text-sm text-muted-foreground">
      {playback.kind === "pending"
        ? "This video is still processing — check back shortly."
        : "Video source unavailable."}
    </div>
  );
}
