import { z } from "zod";

import { slugSchema } from "@/lib/validation/tenant";

export const lessonTypeSchema = z.enum([
  "VIDEO",
  "ARTICLE",
  "QUIZ",
  "ASSIGNMENT",
  "CODE_LAB",
  "RESOURCE",
  "EMBED",
]);

export type LessonType = z.infer<typeof lessonTypeSchema>;

export const createCourseSchema = z.object({
  tenantSlug: slugSchema,
  title: z.string().min(3).max(120),
  slug: slugSchema,
  subtitle: z.string().max(200).optional(),
  level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).default("BEGINNER"),
  categoryId: z.string().optional(),
});

export const updateCourseSettingsSchema = z.object({
  tenantSlug: slugSchema,
  courseId: z.string().min(1),
  title: z.string().min(3).max(120),
  subtitle: z.string().max(200).optional(),
  description: z.any().optional(), // Tiptap JSON
  level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
  categoryId: z.string().optional().nullable(),
  tags: z.array(z.string().min(1).max(30)).max(10).default([]),
  outcomes: z.array(z.string().min(1).max(200)).max(12).default([]),
  prerequisites: z.array(z.string().min(1).max(200)).max(12).default([]),
  language: z.string().min(2).max(10).default("en"),
  visibility: z.enum(["MARKETPLACE", "TENANT_ONLY", "PRIVATE"]),
  selfPacedEnabled: z.boolean(),
  liveEnabled: z.boolean(),
  estimatedHours: z.number().positive().max(1000).optional().nullable(),
  certificateEnabled: z.boolean(),
});

export const courseIdInput = z.object({
  tenantSlug: slugSchema,
  courseId: z.string().min(1),
});

export const upsertSectionSchema = z.object({
  tenantSlug: slugSchema,
  courseId: z.string().min(1),
  sectionId: z.string().optional(),
  title: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
});

export const upsertLessonSchema = z.object({
  tenantSlug: slugSchema,
  courseId: z.string().min(1),
  sectionId: z.string().min(1),
  lessonId: z.string().optional(),
  type: lessonTypeSchema,
  title: z.string().min(1).max(160),
  isFreePreview: z.boolean().default(false),
  releaseAfterDays: z.number().int().min(0).max(730).optional().nullable(),
  durationSec: z.number().int().min(0).optional().nullable(),
  content: z.any().optional(), // Tiptap JSON / embed config
  videoAssetId: z.string().optional().nullable(),
  externalVideoUrl: z.url().optional().or(z.literal("")),
  labConfig: z
    .object({
      provider: z.literal("FERMION"),
      labRef: z.string().optional(),
      dsaProblemRefs: z.array(z.string()).optional(),
    })
    .optional()
    .nullable(),
});

export const reorderSchema = z.object({
  tenantSlug: slugSchema,
  courseId: z.string().min(1),
  kind: z.enum(["SECTION", "LESSON"]),
  id: z.string().min(1),
  direction: z.enum(["UP", "DOWN"]),
});

export const deleteEntitySchema = z.object({
  tenantSlug: slugSchema,
  courseId: z.string().min(1),
  kind: z.enum(["SECTION", "LESSON"]),
  id: z.string().min(1),
});

export const requestLessonVideoUploadSchema = z.object({
  tenantSlug: slugSchema,
  courseId: z.string().min(1),
  lessonId: z.string().min(1),
  filename: z
    .string()
    .min(1)
    .max(255)
    .regex(/\.(mp4|mov|webm|mkv|m4v)$/i, "Unsupported video format."),
});

export const confirmLessonVideoUploadSchema = z.object({
  tenantSlug: slugSchema,
  courseId: z.string().min(1),
  videoAssetId: z.string().min(1),
});

export const setCoursePriceSchema = z.object({
  tenantSlug: slugSchema,
  courseId: z.string().min(1),
  amountRupees: z.number().min(0).max(1_000_000),
  compareAtRupees: z.number().min(0).max(1_000_000).optional().nullable(),
});

export const upsertCohortSchema = z.object({
  tenantSlug: slugSchema,
  courseId: z.string().min(1),
  cohortId: z.string().optional(),
  name: z.string().min(2).max(120),
  slug: slugSchema,
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().optional().nullable(),
  enrollmentClosesAt: z.coerce.date().optional().nullable(),
  capacity: z.number().int().positive().max(100000).optional().nullable(),
  seatPriceRupees: z.number().min(0).max(1_000_000).optional().nullable(),
});

export const submitCourseForReviewSchema = courseIdInput;

export const reviewCourseSchema = z.object({
  courseId: z.string().min(1),
  decision: z.enum(["PUBLISHED", "DRAFT"]),
  note: z.string().max(1000).optional(),
});

// Quiz authoring
export const upsertQuizSchema = z.object({
  tenantSlug: slugSchema,
  courseId: z.string().min(1),
  lessonId: z.string().min(1),
  title: z.string().min(1).max(160),
  passPct: z.number().int().min(0).max(100).default(60),
  maxAttempts: z.number().int().min(1).max(20).optional().nullable(),
  timeLimitSec: z.number().int().min(30).max(14400).optional().nullable(),
  drawCount: z.number().int().min(1).max(200).optional().nullable(),
  shuffleQuestions: z.boolean().default(true),
  showAnswers: z
    .enum(["NEVER", "AFTER_ATTEMPT", "AFTER_ALL_ATTEMPTS", "AFTER_CLOSE"])
    .default("AFTER_ATTEMPT"),
});

export const upsertQuizQuestionSchema = z.object({
  tenantSlug: slugSchema,
  courseId: z.string().min(1),
  quizId: z.string().min(1),
  questionId: z.string().optional(),
  type: z.enum(["SINGLE_CHOICE", "MULTI_CHOICE", "TRUE_FALSE", "SHORT_TEXT"]),
  prompt: z.string().min(1).max(2000),
  options: z.array(z.string().min(1).max(500)).max(8).default([]),
  correctIndexes: z.array(z.number().int().min(0)).default([]),
  correctText: z.string().max(500).optional(),
  points: z.number().int().min(1).max(100).default(1),
  explanation: z.string().max(2000).optional(),
  poolTag: z.string().max(40).optional(),
});

export const deleteQuizQuestionSchema = z.object({
  tenantSlug: slugSchema,
  courseId: z.string().min(1),
  quizId: z.string().min(1),
  questionId: z.string().min(1),
});

export const upsertAssignmentSchema = z.object({
  tenantSlug: slugSchema,
  courseId: z.string().min(1),
  lessonId: z.string().min(1),
  title: z.string().min(1).max(160),
  instructions: z.string().min(1).max(10000),
  gradingType: z.enum(["MANUAL", "AUTO", "PEER"]).default("MANUAL"),
  maxPoints: z.number().int().min(1).max(1000).default(100),
  submissionKinds: z
    .array(z.enum(["TEXT", "FILE", "REPO_URL", "URL"]))
    .min(1)
    .default(["TEXT"]),
  allowResubmission: z.boolean().default(true),
});
