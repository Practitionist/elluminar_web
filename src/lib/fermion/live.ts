import "server-only";

import { db } from "@/lib/db";
import { fermionFetch } from "@/lib/fermion/client";

/**
 * Live-class orchestration. Our LiveSession row is the source of truth;
 * Fermion provides the actual room + recording.
 */
export async function provisionFermionLiveSession(liveSessionId: string) {
  const session = await db.liveSession.findUniqueOrThrow({
    where: { id: liveSessionId },
  });
  if (session.provider !== "FERMION") return session;
  if (session.providerSessionRef) return session;

  const created = await fermionFetch<{ liveEventSessionId: string }>(
    "create-live-session",
    {
      title: session.title,
      startTime: session.scheduledStartAt.toISOString(),
      endTime: session.scheduledEndAt.toISOString(),
    },
  );

  return db.liveSession.update({
    where: { id: liveSessionId },
    data: { providerSessionRef: created.liveEventSessionId },
  });
}

/** Signed HLS/join data for an embedded live room. */
export async function getLiveSessionEmbedData(liveSessionId: string) {
  const session = await db.liveSession.findUniqueOrThrow({
    where: { id: liveSessionId },
  });
  if (session.provider === "EXTERNAL_LINK") {
    return { kind: "external" as const, joinUrl: session.joinUrl };
  }
  if (!session.providerSessionRef) {
    return { kind: "pending" as const };
  }
  const data = await fermionFetch<Record<string, unknown>>(
    "get-signed-url-data-for-live-event-session",
    { liveEventSessionId: session.providerSessionRef },
  );
  return { kind: "fermion" as const, data };
}
