import "server-only";

import { db } from "@/lib/db";
import { fermionFetch, fermionSchoolHostname } from "@/lib/fermion/client";
import { signFermionJwt } from "@/lib/fermion/jwt";

/**
 * Code labs & DSA judge. Lesson.labConfig carries the Fermion refs:
 *   { provider: "FERMION", labRef?: string, dsaProblemRefs?: string[] }
 *
 * Embed URLs follow docs.fermion.app ("Embed an Interactive Lab" /
 * "Embed an IO Lab"): https://<school>/embed/lab?token=<JWT> with claims
 * { labId, userId }, signed by the API key, 1h TTL.
 */

export type LabConfig = {
  provider: "FERMION";
  labRef?: string;
  dsaProblemRefs?: string[];
};

export type LabEmbedKind = "INTERACTIVE_LAB" | "IO_LAB";

/** Builds the sandboxed iframe src for an embedded Fermion lab. */
export function buildLabEmbedUrl(input: {
  labId: string;
  userId: string;
  kind?: LabEmbedKind;
}) {
  const path =
    input.kind === "IO_LAB" ? "/embed/io-coding-lab" : "/embed/lab";
  const token = signFermionJwt({ labId: input.labId, userId: input.userId }, 3600);
  return `https://${fermionSchoolHostname()}${path}?token=${encodeURIComponent(token)}`;
}

/** Records a lab/judge usage session for Fermion cost metering. */
export async function recordSandboxSession(input: {
  userId: string;
  lessonId?: string;
  projectInstanceId?: string;
  kind: "INTERACTIVE_LAB" | "DSA_RUN" | "SANDBOX_VM";
  providerRef: string;
  metadata?: Record<string, unknown>;
}) {
  return db.sandboxSession.create({
    data: {
      userId: input.userId,
      lessonId: input.lessonId,
      projectInstanceId: input.projectInstanceId,
      kind: input.kind,
      provider: "FERMION",
      providerRef: input.providerRef,
      metadata: (input.metadata ?? undefined) as object | undefined,
    },
  });
}

export async function requestDsaRun(input: {
  problemRef: string;
  language: string;
  sourceCode: string;
}) {
  return fermionFetch<{ taskId: string }>("request-dsa-code-execution", {
    problemId: input.problemRef,
    language: input.language,
    sourceCode: input.sourceCode,
  });
}

export async function getDsaRunResult(taskId: string) {
  return fermionFetch<Record<string, unknown>>("get-dsa-code-execution-result", {
    taskId,
  });
}
