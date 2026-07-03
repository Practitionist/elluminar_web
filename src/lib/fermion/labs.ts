import "server-only";

import { db } from "@/lib/db";
import { fermionFetch } from "@/lib/fermion/client";

/**
 * Code labs & DSA judge. Lesson.labConfig carries the Fermion refs:
 *   { provider: "FERMION", labRef?: string, dsaProblemRefs?: string[] }
 */

export type LabConfig = {
  provider: "FERMION";
  labRef?: string;
  dsaProblemRefs?: string[];
};

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
