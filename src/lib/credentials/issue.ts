import "server-only";

import { customAlphabet } from "nanoid";

import { db } from "@/lib/db";

// Unambiguous, human-readable verification codes (no 0/O/1/I).
const codeAlphabet = customAlphabet("23456789ABCDEFGHJKMNPQRSTUVWXYZ", 12);

function formatVerificationCode() {
  const raw = codeAlphabet();
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

/** Issues a course-completion credential once (idempotent per enrollment). */
export async function issueCourseCredentialIfEarned(enrollmentId: string) {
  const enrollment = await db.enrollment.findUniqueOrThrow({
    where: { id: enrollmentId },
    include: { course: true, user: true },
  });
  if (!enrollment.course.certificateEnabled) return null;

  const existing = await db.credential.findFirst({
    where: { userId: enrollment.userId, kind: "COURSE", courseId: enrollment.courseId },
  });
  if (existing) return existing;

  const template =
    (enrollment.course.certificateTemplateId
      ? await db.certificateTemplate.findUnique({
          where: { id: enrollment.course.certificateTemplateId },
        })
      : null) ??
    (await db.certificateTemplate.findFirst({
      where: { tenantId: null, kind: "GENERIC", active: true },
    }));

  const credential = await db.credential.create({
    data: {
      userId: enrollment.userId,
      kind: "COURSE",
      courseId: enrollment.courseId,
      templateId: template?.id,
      title: enrollment.course.title,
      verificationCode: formatVerificationCode(),
      metadata: { courseSlug: enrollment.course.slug },
    },
  });

  await db.notification.create({
    data: {
      userId: enrollment.userId,
      category: "credential",
      title: "Certificate earned 🎉",
      body: `You completed “${enrollment.course.title}”. Your verifiable certificate is ready.`,
      actionUrl: `/verify/${credential.verificationCode}`,
    },
  });
  return credential;
}

/** Issues a co-branded program credential on completion (idempotent). */
export async function issueProgramCredential(programEnrollmentId: string) {
  const pe = await db.programEnrollment.findUniqueOrThrow({
    where: { id: programEnrollmentId },
    include: {
      programCohort: {
        include: { program: { include: { certificateTemplate: true } } },
      },
    },
  });

  const existing = await db.credential.findFirst({
    where: { kind: "PROGRAM", programEnrollmentId },
  });
  if (existing) return existing;

  const program = pe.programCohort.program;
  const coBrand = (program.certificateTemplate?.coBrand ?? null) as {
    partnerName?: string;
  } | null;

  const credential = await db.credential.create({
    data: {
      userId: pe.userId,
      kind: "PROGRAM",
      programEnrollmentId,
      templateId: program.certificateTemplateId,
      title: program.title,
      grade: pe.finalGrade,
      verificationCode: formatVerificationCode(),
      metadata: {
        programSlug: program.slug,
        cohort: pe.programCohort.name,
        ...(coBrand?.partnerName ? { coBrandPartner: coBrand.partnerName } : {}),
      },
    },
  });

  await db.notification.create({
    data: {
      userId: pe.userId,
      category: "credential",
      title: "Program certificate earned 🎓",
      body: `You completed “${program.title}”${coBrand?.partnerName ? ` — co-certified with ${coBrand.partnerName}` : ""}.`,
      actionUrl: `/verify/${credential.verificationCode}`,
    },
  });
  return credential;
}

/** Issues a project credential when an instance passes (idempotent). */
export async function issueProjectCredential(projectInstanceId: string) {
  const instance = await db.projectInstance.findUniqueOrThrow({
    where: { id: projectInstanceId },
    include: { project: true },
  });
  if (!instance.project.certificateEnabled) return null;

  const existing = await db.credential.findFirst({
    where: { kind: "PROJECT", projectInstanceId },
  });
  if (existing) return existing;

  const credential = await db.credential.create({
    data: {
      userId: instance.userId,
      kind: "PROJECT",
      projectInstanceId,
      title: instance.project.title,
      grade: instance.finalScore != null ? `${Math.round(instance.finalScore)}%` : null,
      verificationCode: formatVerificationCode(),
      metadata: {
        tier: instance.project.tier,
        mentorReviewed: true,
        defenseRequired: instance.project.defenseRequired,
      },
    },
  });

  await db.notification.create({
    data: {
      userId: instance.userId,
      category: "credential",
      title: "Project credential earned 🏆",
      body: `Mentor-verified: “${instance.project.title}”. Share your proof of work.`,
      actionUrl: `/verify/${credential.verificationCode}`,
    },
  });
  return credential;
}
