 
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import {
  creatorEntitlementsSchema,
  learnerEntitlementsSchema,
} from "../src/lib/validation/entitlements";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL! });
const db = new PrismaClient({ adapter });

const INR = "INR";
const paise = (rupees: number) => BigInt(Math.round(rupees * 100));

async function seedPlatformConfig() {
  const entries: Array<{ key: string; value: unknown; description: string }> = [
    { key: "commerce.defaultCommissionBps", value: 2000, description: "Standard creator plan platform commission (20%)" },
    { key: "commerce.proCommissionBps", value: 1200, description: "Creator Pro platform commission (12%)" },
    { key: "commerce.gstRateBps", value: 1800, description: "GST rate on digital services (18%)" },
    { key: "commerce.pricesIncludeTax", value: true, description: "Displayed prices are tax-inclusive (Indian consumer norm)" },
    { key: "commerce.defaultRefundWindowDays", value: 14, description: "14-day no-questions refund window (teardown steal)" },
    { key: "commerce.refundConsumptionCapPct", value: 30, description: "Refund void once >30% of course content consumed" },
    {
      key: "projects.mentorAttributableBpsByTier",
      value: { SPRINT: 1000, CAPSTONE: 4000, FLAGSHIP: 5000 },
      description: "Share of a project item's net revenue attributable to mentor time; mentor payout = MentorProfile.defaultPayoutBps of this",
    },
    { key: "projects.reviewSlaHoursByTier", value: { SPRINT: 48, CAPSTONE: 72, FLAGSHIP: 48 }, description: "Mentor review turnaround SLA (hours)" },
  ];
  for (const e of entries) {
    await db.platformConfig.upsert({
      where: { key: e.key },
      update: { value: e.value as object, description: e.description },
      create: { key: e.key, value: e.value as object, description: e.description },
    });
  }
  console.log(`✓ PlatformConfig (${entries.length})`);
}

async function seedCategories() {
  const categories = [
    { slug: "web-development", name: "Web Development" },
    { slug: "data-science-ai", name: "Data Science & AI" },
    { slug: "devops-cloud", name: "DevOps & Cloud" },
    { slug: "mobile-development", name: "Mobile Development" },
    { slug: "programming-languages", name: "Programming Languages" },
    { slug: "system-design", name: "System Design" },
    { slug: "qa-testing", name: "QA & Test Automation" },
    { slug: "cybersecurity", name: "Cybersecurity" },
    { slug: "blockchain", name: "Blockchain & Web3" },
    { slug: "product-design", name: "Product & Design" },
  ];
  for (const [i, c] of categories.entries()) {
    await db.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, sort: i },
      create: { ...c, sort: i },
    });
  }
  console.log(`✓ Categories (${categories.length})`);
}

async function seedPlans() {
  const learnerPlans = [
    {
      code: "FREE",
      name: "Free",
      tagline: "Explore the marketplace",
      sort: 0,
      trialDays: 0,
      entitlements: learnerEntitlementsSchema.parse({}),
      prices: [],
    },
    {
      code: "LEARN",
      name: "Learn",
      tagline: "The full self-paced library",
      sort: 1,
      trialDays: 7,
      entitlements: learnerEntitlementsSchema.parse({
        libraryAccess: true,
        cohortAccess: "REPLAY",
        alaCarteDiscountBps: 500,
        aiDailyCredits: 50,
      }),
      prices: [
        { interval: "MONTHLY" as const, amount: paise(999), compareAt: null },
        { interval: "ANNUAL" as const, amount: paise(9999), compareAt: paise(11988) },
      ],
    },
    {
      code: "MENTOR",
      name: "Mentor",
      tagline: "Guided practice with real mentors",
      sort: 2,
      trialDays: 0,
      entitlements: learnerEntitlementsSchema.parse({
        libraryAccess: true,
        cohortAccess: "INCLUDED",
        capstoneDiscountBps: 2000,
        alaCarteDiscountBps: 500,
        sprintCreditsPerMonth: 1,
        portfolioTier: "VERIFIED",
        aiDailyCredits: 150,
      }),
      prices: [
        { interval: "MONTHLY" as const, amount: paise(2499), compareAt: null },
        { interval: "ANNUAL" as const, amount: paise(24999), compareAt: paise(29988) },
      ],
    },
    {
      code: "CAREER",
      name: "Career",
      tagline: "A mentor-backed career outcome",
      sort: 3,
      trialDays: 0,
      entitlements: learnerEntitlementsSchema.parse({
        libraryAccess: true,
        cohortAccess: "PRIORITY",
        capstoneDiscountBps: 3000,
        alaCarteDiscountBps: 1000,
        sprintCreditsPerMonth: 2,
        flagshipCreditsPerYear: 1, // activates when Flagship ships (FeatureFlag-gated)
        priorityMentorMatching: true,
        hiringVisibility: true,
        mockInterviewDiscountBps: 2500,
        placementSupport: true,
        portfolioTier: "VERIFIED",
        aiDailyCredits: 300,
      }),
      prices: [
        { interval: "MONTHLY" as const, amount: paise(4999), compareAt: null },
        { interval: "ANNUAL" as const, amount: paise(49999), compareAt: paise(59988) },
      ],
    },
  ];

  for (const p of learnerPlans) {
    const plan = await db.subscriptionPlan.upsert({
      where: { code: p.code },
      update: {
        name: p.name,
        tagline: p.tagline,
        sort: p.sort,
        trialDays: p.trialDays,
        entitlements: p.entitlements,
        active: true,
      },
      create: {
        code: p.code,
        audience: "LEARNER",
        name: p.name,
        tagline: p.tagline,
        sort: p.sort,
        trialDays: p.trialDays,
        entitlements: p.entitlements,
      },
    });
    for (const price of p.prices) {
      const existing = await db.price.findFirst({
        where: { planId: plan.id, currency: INR, interval: price.interval, region: null },
      });
      if (existing) {
        await db.price.update({
          where: { id: existing.id },
          data: { amountMinor: price.amount, compareAtMinor: price.compareAt, active: true },
        });
      } else {
        await db.price.create({
          data: {
            itemType: "PLAN",
            planId: plan.id,
            currency: INR,
            interval: price.interval,
            amountMinor: price.amount,
            compareAtMinor: price.compareAt,
          },
        });
      }
    }
  }

  const creatorPro = await db.subscriptionPlan.upsert({
    where: { code: "CREATOR_PRO" },
    update: { active: true },
    create: {
      code: "CREATOR_PRO",
      audience: "CREATOR",
      name: "Creator Pro",
      tagline: "Lower commission for serious creators",
      sort: 10,
      entitlements: creatorEntitlementsSchema.parse({
        commissionBps: 1200,
        customDomain: true,
        prioritySupport: true,
      }),
    },
  });
  const existingCreatorPrice = await db.price.findFirst({
    where: { planId: creatorPro.id, currency: INR, interval: "MONTHLY", region: null },
  });
  if (!existingCreatorPrice) {
    await db.price.create({
      data: {
        itemType: "PLAN",
        planId: creatorPro.id,
        currency: INR,
        interval: "MONTHLY",
        amountMinor: paise(2999),
      },
    });
  }
  console.log("✓ SubscriptionPlans (FREE/LEARN/MENTOR/CAREER + CREATOR_PRO) with INR prices");
}

async function seedBadges() {
  const badges = [
    { code: "first-lesson", name: "First Steps", description: "Completed your first lesson", criteria: { kind: "LESSON_COMPLETED", count: 1 } },
    { code: "streak-7", name: "One Week Streak", description: "7 days of continuous learning", criteria: { kind: "STREAK", days: 7 } },
    { code: "streak-30", name: "Momentum", description: "30 days of continuous learning", criteria: { kind: "STREAK", days: 30 } },
    { code: "first-course", name: "Course Conqueror", description: "Completed your first course", criteria: { kind: "COURSE_COMPLETED", count: 1 } },
    { code: "first-project", name: "Proof of Work", description: "Passed your first mentor-reviewed project", criteria: { kind: "PROJECT_PASSED", count: 1 } },
    { code: "community-helper", name: "Community Helper", description: "10 accepted answers in discussions", criteria: { kind: "ACCEPTED_ANSWERS", count: 10 } },
  ];
  for (const b of badges) {
    await db.badge.upsert({
      where: { code: b.code },
      update: { name: b.name, description: b.description, criteria: b.criteria },
      create: b,
    });
  }
  console.log(`✓ Badges (${badges.length})`);
}

async function seedInvoiceSeries() {
  for (const series of ["INV", "CN"]) {
    await db.invoiceSeries.upsert({
      where: { series },
      update: {},
      create: { series },
    });
  }
  console.log("✓ InvoiceSeries (INV, CN)");
}

async function seedFeatureFlags() {
  const flags = [
    { key: "career-tier", description: "Career tier purchasable", enabled: true },
    { key: "career-flagship-credit", description: "Career tier grants Flagship credits (enable when Flagship ships)", enabled: false },
    { key: "sprint-tier", description: "Sprint project tier live", enabled: false },
    { key: "flagship-tier", description: "Flagship project tier live", enabled: false },
    { key: "ai-tutor", description: "AI teaching assistant", enabled: false },
    { key: "defense-engine", description: "Live defense scheduling", enabled: false },
    { key: "talent-marketplace", description: "Hiring-partner talent search", enabled: false },
  ];
  for (const f of flags) {
    await db.featureFlag.upsert({
      where: { key: f.key },
      update: { description: f.description },
      create: f,
    });
  }
  console.log(`✓ FeatureFlags (${flags.length})`);
}

async function seedCertificateTemplate() {
  const existing = await db.certificateTemplate.findFirst({
    where: { tenantId: null, kind: "GENERIC", name: "Default" },
  });
  if (!existing) {
    await db.certificateTemplate.create({
      data: {
        name: "Default",
        kind: "GENERIC",
        design: {
          layout: "landscape-a4",
          accentColor: "#0f172a",
          heading: "Certificate of Completion",
          showGrade: true,
          showVerificationQr: true,
        },
      },
    });
  }
  console.log("✓ CertificateTemplate (Default)");
}

async function seedPlatformTenant() {
  const org = await db.organization.upsert({
    where: { slug: "platform" },
    update: {},
    create: {
      id: "org_platform",
      name: "lms-web Platform",
      slug: "platform",
    },
  });
  await db.tenant.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      type: "CREATOR",
      status: "APPROVED",
      slug: "platform",
      displayName: "lms-web",
      commissionBps: 0,
      marketplaceOptInDefault: true,
      approvedAt: new Date(),
    },
  });
  console.log("✓ Platform organization + tenant");
}

async function seedDemoContent() {
  if (process.env.NODE_ENV === "production") return;

  const org = await db.organization.upsert({
    where: { slug: "demo-academy" },
    update: {},
    create: { id: "org_demo_academy", name: "Demo Academy", slug: "demo-academy" },
  });
  const tenant = await db.tenant.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      type: "CREATOR",
      status: "APPROVED",
      slug: "demo-academy",
      displayName: "Demo Academy",
      about: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hands-on engineering courses by industry practitioners." }] }] },
      approvedAt: new Date(),
    },
  });

  const category = await db.category.findUniqueOrThrow({ where: { slug: "web-development" } });

  // Demo course
  const course = await db.course.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: "fullstack-nextjs" } },
    update: {},
    create: {
      tenantId: tenant.id,
      title: "Full-Stack Next.js in Production",
      slug: "fullstack-nextjs",
      subtitle: "Ship a real SaaS with App Router, Postgres, and payments",
      description: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Build and deploy a production SaaS from scratch." }] }] },
      outcomes: ["Design an App Router architecture", "Model data with Prisma", "Integrate payments end-to-end"],
      prerequisites: ["JavaScript fundamentals", "Basic React"],
      level: "INTERMEDIATE",
      categoryId: category.id,
      tags: ["nextjs", "react", "prisma", "payments"],
      status: "PUBLISHED",
      liveEnabled: true,
      estimatedHours: 24,
      publishedAt: new Date(),
    },
  });

  const existingSections = await db.courseSection.count({ where: { courseId: course.id } });
  if (existingSections === 0) {
    const s1 = await db.courseSection.create({
      data: { courseId: course.id, title: "Foundations", position: 0 },
    });
    const s2 = await db.courseSection.create({
      data: { courseId: course.id, title: "Data & Auth", position: 1 },
    });
    await db.lesson.createMany({
      data: [
        { sectionId: s1.id, courseId: course.id, type: "ARTICLE", title: "How this course works", position: 0, isFreePreview: true, content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Welcome!" }] }] } },
        { sectionId: s1.id, courseId: course.id, type: "VIDEO", title: "App Router mental model", position: 1, isFreePreview: true, durationSec: 900 },
        { sectionId: s1.id, courseId: course.id, type: "CODE_LAB", title: "Lab: your first server action", position: 2, labConfig: { provider: "FERMION", labRef: "demo-lab" } },
        { sectionId: s2.id, courseId: course.id, type: "VIDEO", title: "Modeling with Prisma", position: 0, durationSec: 1200 },
        { sectionId: s2.id, courseId: course.id, type: "QUIZ", title: "Checkpoint: data modeling", position: 1 },
        { sectionId: s2.id, courseId: course.id, type: "ASSIGNMENT", title: "Assignment: schema design", position: 2 },
      ],
    });

    const quizLesson = await db.lesson.findFirstOrThrow({
      where: { courseId: course.id, type: "QUIZ" },
    });
    const quiz = await db.quiz.create({
      data: {
        lessonId: quizLesson.id,
        title: "Data modeling checkpoint",
        passPct: 70,
        maxAttempts: 3,
        questions: {
          create: [
            {
              type: "SINGLE_CHOICE",
              prompt: { text: "Which Prisma field type should store money amounts?" },
              options: { choices: ["Float", "BigInt minor units", "String", "Decimal always"] },
              correct: { index: 1 },
              points: 2,
              explanation: "Integer minor units avoid floating-point drift.",
              position: 0,
            },
            {
              type: "TRUE_FALSE",
              prompt: { text: "A bundle order item should have a single enrollment FK." },
              options: { choices: ["True", "False"] },
              correct: { index: 1 },
              points: 1,
              explanation: "Bundles fan out to N fulfillments — links are reverse-only.",
              position: 1,
            },
          ],
        },
      },
    });
    void quiz;

    const assignmentLesson = await db.lesson.findFirstOrThrow({
      where: { courseId: course.id, type: "ASSIGNMENT" },
    });
    await db.assignment.create({
      data: {
        lessonId: assignmentLesson.id,
        title: "Design a schema for a booking app",
        instructions: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Model users, listings, and bookings. Submit a repo link." }] }] },
        gradingType: "MANUAL",
        maxPoints: 100,
        submissionKinds: ["REPO_URL", "TEXT"],
      },
    });
  }

  const existingCoursePrice = await db.price.findFirst({
    where: { courseId: course.id, currency: INR, region: null },
  });
  if (!existingCoursePrice) {
    await db.price.create({
      data: { itemType: "COURSE", courseId: course.id, currency: INR, amountMinor: paise(4999), compareAtMinor: paise(7999) },
    });
  }

  // Demo cohort
  const cohort = await db.cohort.upsert({
    where: { courseId_slug: { courseId: course.id, slug: "aug-2026" } },
    update: {},
    create: {
      courseId: course.id,
      name: "August 2026 Cohort",
      slug: "aug-2026",
      startsAt: new Date("2026-08-03T13:30:00Z"),
      endsAt: new Date("2026-09-28T15:30:00Z"),
      enrollmentClosesAt: new Date("2026-08-01T18:30:00Z"),
      capacity: 60,
      status: "OPEN",
    },
  });
  const existingCohortPrice = await db.price.findFirst({
    where: { cohortId: cohort.id, currency: INR, region: null },
  });
  if (!existingCohortPrice) {
    await db.price.create({
      data: { itemType: "COHORT_SEAT", cohortId: cohort.id, currency: INR, amountMinor: paise(12999) },
    });
  }

  // Demo Capstone project with rubric + milestones
  let rubric = await db.rubric.findFirst({ where: { tenantId: tenant.id, name: "Capstone rubric" } });
  if (!rubric) {
    rubric = await db.rubric.create({
      data: {
        tenantId: tenant.id,
        name: "Capstone rubric",
        version: 1,
        criteria: {
          create: [
            { name: "Correctness", description: "Meets the held-out evaluation", weightPct: 40, levels: { bands: [{ max: 40, label: "Excellent" }] }, position: 0 },
            { name: "Code quality", description: "Structure, tests, readability", weightPct: 30, levels: { bands: [{ max: 30, label: "Excellent" }] }, position: 1 },
            { name: "Design judgment", description: "Tradeoffs made and justified", weightPct: 30, levels: { bands: [{ max: 30, label: "Excellent" }] }, position: 2 },
          ],
        },
      },
    });
  }

  const project = await db.project.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: "realtime-collab-editor" } },
    update: {},
    create: {
      tenantId: tenant.id,
      title: "Real-Time Collaborative Editor",
      slug: "realtime-collab-editor",
      tier: "CAPSTONE",
      summary: "Build a Google-Docs-style collaborative editor with CRDT sync, presence, and offline support.",
      brief: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Ambiguous, production-scale brief: requirements are deliberately incomplete — you make and justify the tradeoffs." }] }] },
      techStack: ["typescript", "websockets", "crdt", "postgres"],
      categoryId: category.id,
      durationWeeksMin: 4,
      durationWeeksMax: 8,
      mentorHoursBudget: 4,
      status: "PUBLISHED",
      rubricId: rubric.id,
      heldOutEvalConfig: { harness: "private-e2e-suite", cases: 24 },
      defenseRequired: true,
      publishedAt: new Date(),
      milestones: {
        create: [
          { title: "Architecture & sync design", description: { text: "Document your CRDT/OT choice and data flow" }, position: 0, expectedWeek: 1, deliverables: { items: ["design doc", "repo skeleton"] }, isReviewCheckpoint: true, weightPct: 20 },
          { title: "Core editing + sync", description: { text: "Two clients converge under concurrent edits" }, position: 1, expectedWeek: 3, deliverables: { items: ["working sync demo"] }, isReviewCheckpoint: true, weightPct: 40 },
          { title: "Presence, offline & hardening", description: { text: "Presence cursors, offline queue, conflict tests" }, position: 2, expectedWeek: 5, deliverables: { items: ["final repo", "demo video"] }, isReviewCheckpoint: true, weightPct: 40 },
        ],
      },
    },
  });
  const existingProjectPrice = await db.price.findFirst({
    where: { projectId: project.id, currency: INR, region: null, mentorLevel: null },
  });
  if (!existingProjectPrice) {
    await db.price.createMany({
      data: [
        { itemType: "PROJECT", projectId: project.id, currency: INR, amountMinor: paise(19999) },
        { itemType: "PROJECT", projectId: project.id, currency: INR, amountMinor: paise(24999), mentorLevel: "SENIOR" },
        { itemType: "PROJECT", projectId: project.id, currency: INR, amountMinor: paise(29999), mentorLevel: "PRINCIPAL" },
      ],
    });
  }

  console.log("✓ Demo content (Demo Academy: course, cohort, capstone project)");
}

async function main() {
  console.log("Seeding lms_web…");
  await seedPlatformConfig();
  await seedCategories();
  await seedPlans();
  await seedBadges();
  await seedInvoiceSeries();
  await seedFeatureFlags();
  await seedCertificateTemplate();
  await seedPlatformTenant();
  await seedDemoContent();
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
