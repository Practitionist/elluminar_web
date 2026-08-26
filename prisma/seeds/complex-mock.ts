// Complex, realistic mock data enrichment for populated dashboards.
//
// Everything here is IDEMPOTENT: keyed by deterministic slugs/emails/composite
// uniques or synthetic dedup refs, so re-running never duplicates and never
// deletes/overwrites base-seed data destructively.
//
// Money is BigInt minor units (paise). Percentages are basis points.

import type { PrismaClient } from "../../src/generated/prisma/client";

const INR = "INR";
const paise = (rupees: number) => BigInt(Math.round(rupees * 100));
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000);
const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

/** Tax-inclusive money breakdown for an order line (18% GST, given commission bps). */
function money(unitMinor: bigint, commissionBps: number, taxRateBps = 1800) {
  const base = (unitMinor * 10000n) / (10000n + BigInt(taxRateBps)); // pre-tax
  const tax = unitMinor - base;
  const platformFee = (base * BigInt(commissionBps)) / 10000n;
  const sellerEarnings = base - platformFee;
  return { base, tax, platformFee, sellerEarnings };
}

type CatalogEntry = {
  kind: "COURSE" | "PROJECT";
  id: string;
  tenantId: string;
  tenantSlug: string;
  title: string;
  unitMinor: bigint;
};

export async function seedComplexMockData(db: PrismaClient) {
  if (process.env.NODE_ENV === "production") return;
  console.log("→ Complex mock data enrichment…");

  // ─────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────
  const ensureUser = (email: string, name: string, extra: Record<string, unknown> = {}) =>
    db.user.upsert({
      where: { email },
      update: {},
      create: { email, name, emailVerified: true, onboardedAt: daysAgo(90), ...extra },
    });

  const ensureMember = async (organizationId: string, userId: string, role: string) => {
    await db.member.upsert({
      where: { organizationId_userId: { organizationId, userId } },
      update: { role },
      create: { organizationId, userId, role },
    });
  };

  const ensureCreatorTenant = async (
    orgId: string,
    slug: string,
    name: string,
    aboutText: string,
    ownerUserId: string,
  ) => {
    const org = await db.organization.upsert({
      where: { slug },
      update: {},
      create: { id: orgId, name, slug },
    });
    const tenant = await db.tenant.upsert({
      where: { organizationId: org.id },
      update: { status: "APPROVED", type: "CREATOR" },
      create: {
        organizationId: org.id,
        type: "CREATOR",
        status: "APPROVED",
        slug,
        displayName: name,
        about: doc(aboutText),
        approvedAt: daysAgo(120),
        supportEmail: `support@${slug}.test`,
      },
    });
    await ensureMember(org.id, ownerUserId, "owner");
    return tenant;
  };

  // ─────────────────────────────────────────────────────────────────────
  // Users: learners, creators, mentors
  // ─────────────────────────────────────────────────────────────────────
  type LearnerSpec = {
    email: string;
    name: string;
    xp: number;
    cur: number;
    long: number;
    badges: string[];
  };

  const LEARNERS: LearnerSpec[] = [
    { email: "ananya@learner.test", name: "Ananya Desai", xp: 4250, cur: 28, long: 35, badges: ["first-lesson", "first-course", "streak-7", "streak-30", "community-helper"] },
    { email: "vikram@learner.test", name: "Vikram Menon", xp: 3680, cur: 21, long: 30, badges: ["first-lesson", "first-course", "streak-7", "streak-30", "first-project"] },
    { email: "isha@learner.test", name: "Isha Reddy", xp: 2740, cur: 12, long: 18, badges: ["first-lesson", "first-course", "streak-7"] },
    { email: "rohit@learner.test", name: "Rohit Malhotra", xp: 2450, cur: 9, long: 14, badges: ["first-lesson", "first-course", "streak-7"] },
    { email: "sana@learner.test", name: "Sana Kapoor", xp: 2180, cur: 7, long: 11, badges: ["first-lesson", "first-course", "streak-7"] },
    { email: "aryan@learner.test", name: "Aryan Joshi", xp: 1890, cur: 5, long: 9, badges: ["first-lesson", "first-course"] },
    { email: "diya@learner.test", name: "Diya Nair", xp: 1620, cur: 4, long: 8, badges: ["first-lesson", "first-course"] },
    { email: "karan@learner.test", name: "Karan Bhatia", xp: 1400, cur: 3, long: 7, badges: ["first-lesson", "streak-7"] },
    { email: "nikita@learner.test", name: "Nikita Rao", xp: 1180, cur: 6, long: 10, badges: ["first-lesson", "first-course"] },
    { email: "farhan@learner.test", name: "Farhan Sheikh", xp: 980, cur: 2, long: 6, badges: ["first-lesson"] },
    { email: "tanvi@learner.test", name: "Tanvi Shah", xp: 820, cur: 8, long: 13, badges: ["first-lesson", "streak-7"] },
    { email: "manish@learner.test", name: "Manish Kulkarni", xp: 640, cur: 1, long: 5, badges: ["first-lesson"] },
    { email: "pooja@learner.test", name: "Pooja Iyer", xp: 520, cur: 3, long: 4, badges: ["first-lesson"] },
    { email: "siddharth@learner.test", name: "Siddharth Ghosh", xp: 410, cur: 0, long: 3, badges: ["first-lesson"] },
    { email: "neha@learner.test", name: "Neha Chauhan", xp: 300, cur: 2, long: 2, badges: ["first-lesson"] },
    { email: "varun@learner.test", name: "Varun Pillai", xp: 180, cur: 1, long: 1, badges: [] },
  ];

  const learnerUsers: Record<string, { id: string; email: string }> = {};
  for (const l of LEARNERS) {
    const u = await ensureUser(l.email, l.name);
    learnerUsers[l.email] = { id: u.id, email: u.email };
  }

  // Existing key users (base seed)
  const arjun = await db.user.findUniqueOrThrow({ where: { email: "arjun@acme.test" } });
  const sneha = await db.user.findUniqueOrThrow({ where: { email: "sneha@acme.test" } });
  const aditi = await db.user.findUniqueOrThrow({ where: { email: "aditi@nalanda.test" } });
  const rahul = await db.user.findUniqueOrThrow({ where: { email: "rahul@nalanda.test" } });
  const zoya = await db.user.findUniqueOrThrow({ where: { email: "zoya@nalanda.test" } });

  // Creator + mentor users
  const gaurav = await ensureUser("gaurav@codecraft.test", "Gaurav Saxena");
  const shreya = await ensureUser("shreya@datawicket.test", "Shreya Bose");
  // Self-heal: the demo-account seed script that used to create this user was
  // dropped in a245761 (prod hardening), which left `pnpm db:seed` failing with
  // P2025 on any clean database. Create it the same way as the creators above.
  const cora = await ensureUser("creator@demo.test", "Cora Dev");

  const mentorRithvik = await ensureUser("rithvik@mentor.test", "Rithvik Menon");
  const mentorLakshmi = await ensureUser("lakshmi@mentor.test", "Lakshmi Narayan");
  const mentorAditya = await ensureUser("aditya@mentor.test", "Aditya Kulkarni");

  // ─────────────────────────────────────────────────────────────────────
  // Creator tenants
  // ─────────────────────────────────────────────────────────────────────
  const demoTenant = await db.tenant.findUniqueOrThrow({ where: { slug: "demo-academy" } });
  const codecraft = await ensureCreatorTenant(
    "org_codecraft",
    "codecraft",
    "CodeCraft Academy",
    "Practical, project-first courses on modern app engineering.",
    gaurav.id,
  );
  const datawicket = await ensureCreatorTenant(
    "org_datawicket",
    "datawicket",
    "DataWicket",
    "Data science and ML training taught by working practitioners.",
    shreya.id,
  );

  const tenantBySlug: Record<string, { id: string; slug: string; creatorId: string }> = {
    "demo-academy": { id: demoTenant.id, slug: "demo-academy", creatorId: cora.id },
    codecraft: { id: codecraft.id, slug: "codecraft", creatorId: gaurav.id },
    datawicket: { id: datawicket.id, slug: "datawicket", creatorId: shreya.id },
  };

  // ─────────────────────────────────────────────────────────────────────
  // Mentor profiles
  // ─────────────────────────────────────────────────────────────────────
  const ensureMentor = async (
    userId: string,
    headline: string,
    level: "ASSOCIATE" | "SENIOR" | "PRINCIPAL",
    expertiseTags: string[],
  ) =>
    db.mentorProfile.upsert({
      where: { userId },
      update: { status: "ACTIVE" },
      create: {
        userId,
        headline,
        bio: doc(headline),
        expertiseTags,
        level,
        status: "ACTIVE",
        vettedAt: daysAgo(200),
        maxActiveInstances: 8,
      },
    });

  const mpRithvik = await ensureMentor(mentorRithvik.id, "Staff Engineer • Distributed Systems", "SENIOR", ["distributed-systems", "backend", "go"]);
  const mpLakshmi = await ensureMentor(mentorLakshmi.id, "Principal Engineer • Realtime & Infra", "PRINCIPAL", ["realtime", "infra", "typescript"]);
  const mpAditya = await ensureMentor(mentorAditya.id, "Senior Engineer • Full-Stack", "ASSOCIATE", ["react", "node", "postgres"]);

  // ─────────────────────────────────────────────────────────────────────
  // Categories lookup
  // ─────────────────────────────────────────────────────────────────────
  const cats = await db.category.findMany({ select: { id: true, slug: true } });
  const catBySlug: Record<string, string> = Object.fromEntries(cats.map((c) => [c.slug, c.id]));

  // ─────────────────────────────────────────────────────────────────────
  // Courses (+ sections, lessons, quiz, assignment, price, rating)
  // ─────────────────────────────────────────────────────────────────────
  const catalog: Record<string, CatalogEntry> = {};

  const ensureCourseContent = async (courseId: string, slug: string) => {
    if ((await db.courseSection.count({ where: { courseId } })) > 0) return;
    const s1 = await db.courseSection.create({ data: { courseId, title: "Getting Started", position: 0 } });
    const s2 = await db.courseSection.create({ data: { courseId, title: "Core Concepts", position: 1 } });
    const s3 = await db.courseSection.create({ data: { courseId, title: "Build & Assess", position: 2 } });
    await db.lesson.createMany({
      data: [
        { sectionId: s1.id, courseId, type: "ARTICLE", title: "Course overview & outcomes", position: 0, isFreePreview: true, content: doc("What you'll build and how the course is structured.") },
        { sectionId: s1.id, courseId, type: "VIDEO", title: "Setting up your environment", position: 1, isFreePreview: true, durationSec: 720 },
        { sectionId: s2.id, courseId, type: "VIDEO", title: "Core concepts, part 1", position: 0, durationSec: 1080 },
        { sectionId: s2.id, courseId, type: "VIDEO", title: "Core concepts, part 2", position: 1, durationSec: 960 },
        { sectionId: s2.id, courseId, type: "CODE_LAB", title: "Hands-on lab", position: 2, labConfig: { provider: "FERMION", labRef: `${slug}-lab-1` } },
        { sectionId: s2.id, courseId, type: "RESOURCE", title: "Cheat sheet & references", position: 3, content: doc("Downloadable references and links.") },
        { sectionId: s3.id, courseId, type: "QUIZ", title: "Knowledge check", position: 0 },
        { sectionId: s3.id, courseId, type: "ASSIGNMENT", title: "Capstone assignment", position: 1 },
      ],
    });
    const quizLesson = await db.lesson.findFirstOrThrow({ where: { courseId, type: "QUIZ" } });
    await db.quiz.create({
      data: {
        lessonId: quizLesson.id,
        title: "Knowledge check",
        // Low-stakes by policy: retrieval practice is what makes quizzes work,
        // so unlimited retries and a modest bar. The credential rests on
        // mentor-reviewed project work, not on clearing a quiz.
        passPct: 60,
        maxAttempts: null,
        questions: {
          create: [
            { type: "SINGLE_CHOICE", prompt: { text: "Which practice does this module recommend first?" }, options: { choices: ["Optimize early", "Measure, then optimize", "Skip tests", "Avoid abstractions"] }, correct: { index: 1 }, points: 2, explanation: "Measure before optimizing.", position: 0 },
            { type: "TRUE_FALSE", prompt: { text: "Idempotent operations can be retried safely." }, options: { choices: ["True", "False"] }, correct: { index: 0 }, points: 1, explanation: "That is the definition of idempotency.", position: 1 },
          ],
        },
      },
    });
    const asLesson = await db.lesson.findFirstOrThrow({ where: { courseId, type: "ASSIGNMENT" } });
    await db.assignment.create({
      data: {
        lessonId: asLesson.id,
        title: "Capstone assignment",
        instructions: doc("Apply the concepts in a small project and submit a repo link with a short write-up."),
        gradingType: "MANUAL",
        maxPoints: 100,
        submissionKinds: ["REPO_URL", "TEXT"],
      },
    });
  };

  const ensureCoursePrice = async (courseId: string, rupees: number, compareRupees: number | null) => {
    const existing = await db.price.findFirst({ where: { courseId, currency: INR, region: null } });
    if (!existing) {
      await db.price.create({
        data: {
          itemType: "COURSE",
          courseId,
          currency: INR,
          amountMinor: paise(rupees),
          compareAtMinor: compareRupees ? paise(compareRupees) : null,
        },
      });
    }
  };

  type CourseSpec = {
    tenantSlug: string;
    slug: string;
    title: string;
    subtitle: string;
    categorySlug: string;
    level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
    tags: string[];
    outcomes: string[];
    hours: number;
    price: number;
    compareAt: number | null;
    ratingAvg: number;
    ratingCount: number;
    liveEnabled?: boolean;
  };

  const COURSES: CourseSpec[] = [
    { tenantSlug: "demo-academy", slug: "python-data-analysis", title: "Python for Data Analysis", subtitle: "Pandas, NumPy and real datasets end-to-end", categorySlug: "data-science-ai", level: "BEGINNER", tags: ["python", "pandas", "numpy"], outcomes: ["Clean messy data", "Aggregate & visualize", "Ship a notebook report"], hours: 18, price: 2999, compareAt: 4999, ratingAvg: 4.7, ratingCount: 214 },
    { tenantSlug: "demo-academy", slug: "docker-kubernetes", title: "Docker & Kubernetes in Practice", subtitle: "Containerize and orchestrate real services", categorySlug: "devops-cloud", level: "INTERMEDIATE", tags: ["docker", "kubernetes", "devops"], outcomes: ["Write production Dockerfiles", "Deploy to k8s", "Roll out safely"], hours: 26, price: 5499, compareAt: 7999, ratingAvg: 4.6, ratingCount: 168, liveEnabled: true },
    { tenantSlug: "demo-academy", slug: "system-design-interview", title: "System Design Interview Prep", subtitle: "Reason about scale, tradeoffs and bottlenecks", categorySlug: "system-design", level: "ADVANCED", tags: ["system-design", "scalability", "interviews"], outcomes: ["Estimate capacity", "Design for scale", "Communicate tradeoffs"], hours: 22, price: 4499, compareAt: null, ratingAvg: 4.8, ratingCount: 301, liveEnabled: true },
    { tenantSlug: "codecraft", slug: "react-native-zero", title: "React Native from Zero", subtitle: "Ship a cross-platform app to both stores", categorySlug: "mobile-development", level: "BEGINNER", tags: ["react-native", "mobile", "expo"], outcomes: ["Build native UI", "Handle navigation", "Publish to stores"], hours: 20, price: 3499, compareAt: 5999, ratingAvg: 4.5, ratingCount: 132 },
    { tenantSlug: "codecraft", slug: "typescript-deep-dive", title: "TypeScript Deep Dive", subtitle: "Master the type system the pros use", categorySlug: "programming-languages", level: "INTERMEDIATE", tags: ["typescript", "types", "generics"], outcomes: ["Model with generics", "Narrow types safely", "Author declaration files"], hours: 15, price: 2499, compareAt: 3999, ratingAvg: 4.9, ratingCount: 276 },
    { tenantSlug: "codecraft", slug: "ethical-hacking", title: "Ethical Hacking Bootcamp", subtitle: "Offensive security fundamentals, hands-on", categorySlug: "cybersecurity", level: "INTERMEDIATE", tags: ["security", "pentest", "networking"], outcomes: ["Recon & scanning", "Exploit common flaws", "Write a report"], hours: 30, price: 6999, compareAt: 9999, ratingAvg: 4.4, ratingCount: 97 },
    { tenantSlug: "datawicket", slug: "ml-foundations", title: "Machine Learning Foundations", subtitle: "From linear models to model evaluation", categorySlug: "data-science-ai", level: "INTERMEDIATE", tags: ["ml", "scikit-learn", "python"], outcomes: ["Train baseline models", "Evaluate rigorously", "Avoid leakage"], hours: 28, price: 5999, compareAt: 8499, ratingAvg: 4.7, ratingCount: 189 },
    { tenantSlug: "datawicket", slug: "sql-mastery", title: "SQL Mastery for Analysts", subtitle: "Window functions, CTEs and query tuning", categorySlug: "data-science-ai", level: "BEGINNER", tags: ["sql", "postgres", "analytics"], outcomes: ["Write complex joins", "Use window functions", "Read query plans"], hours: 14, price: 1999, compareAt: 2999, ratingAvg: 4.8, ratingCount: 243 },
  ];

  for (const c of COURSES) {
    const t = tenantBySlug[c.tenantSlug];
    const course = await db.course.upsert({
      where: { tenantId_slug: { tenantId: t.id, slug: c.slug } },
      update: { ratingAvg: c.ratingAvg, ratingCount: c.ratingCount, status: "PUBLISHED" },
      create: {
        tenantId: t.id,
        createdById: t.creatorId,
        title: c.title,
        slug: c.slug,
        subtitle: c.subtitle,
        description: doc(`${c.title}: ${c.subtitle}.`),
        outcomes: c.outcomes,
        prerequisites: ["Basic programming"],
        level: c.level,
        categoryId: catBySlug[c.categorySlug],
        tags: c.tags,
        status: "PUBLISHED",
        liveEnabled: c.liveEnabled ?? false,
        estimatedHours: c.hours,
        publishedAt: daysAgo(100),
        ratingAvg: c.ratingAvg,
        ratingCount: c.ratingCount,
      },
    });
    await ensureCourseContent(course.id, c.slug);
    await ensureCoursePrice(course.id, c.price, c.compareAt);
    catalog[c.slug] = { kind: "COURSE", id: course.id, tenantId: t.id, tenantSlug: c.tenantSlug, title: c.title, unitMinor: paise(c.price) };
  }

  // Add existing base-seed courses to the catalog + backfill ratings
  for (const [slug, rating] of [["fullstack-nextjs", { avg: 4.8, count: 356, price: 4999 }], ["api-design-essentials", { avg: 4.6, count: 128, price: 1999 }]] as const) {
    const course = await db.course.findFirst({ where: { slug, tenantId: demoTenant.id } });
    if (course) {
      await db.course.update({ where: { id: course.id }, data: { ratingAvg: rating.avg, ratingCount: rating.count } });
      catalog[slug] = { kind: "COURSE", id: course.id, tenantId: demoTenant.id, tenantSlug: "demo-academy", title: course.title, unitMinor: paise(rating.price) };
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Projects (rubric + criteria + milestones + prices)
  // ─────────────────────────────────────────────────────────────────────
  const ensureRubric = async (
    tenantId: string,
    name: string,
    criteria: Array<{ name: string; description: string; weightPct: number }>,
  ) => {
    let rubric = await db.rubric.findFirst({ where: { tenantId, name } });
    if (!rubric) {
      rubric = await db.rubric.create({
        data: {
          tenantId,
          name,
          version: 1,
          criteria: {
            create: criteria.map((cr, i) => ({
              name: cr.name,
              description: cr.description,
              weightPct: cr.weightPct,
              levels: { bands: [{ max: cr.weightPct, label: "Excellent" }, { max: Math.round(cr.weightPct * 0.6), label: "Adequate" }] },
              position: i,
            })),
          },
        },
      });
    }
    return rubric;
  };

  type ProjectSpec = {
    tenantSlug: string;
    slug: string;
    title: string;
    tier: "SPRINT" | "CAPSTONE" | "FLAGSHIP";
    summary: string;
    categorySlug: string;
    techStack: string[];
    weeksMin: number;
    weeksMax: number;
    mentorHours: number;
    price: number;
    seniorPrice: number;
    principalPrice: number;
    ratingAvg: number;
    ratingCount: number;
    rubricName: string;
    criteria: Array<{ name: string; description: string; weightPct: number }>;
    milestones: Array<{ title: string; text: string; week: number; weightPct: number }>;
  };

  const PROJECTS: ProjectSpec[] = [
    {
      tenantSlug: "demo-academy", slug: "checkout-service", title: "Production Checkout Service", tier: "SPRINT",
      summary: "Design and build an idempotent checkout + payments service with retries and webhooks.",
      categorySlug: "web-development", techStack: ["typescript", "postgres", "stripe"], weeksMin: 2, weeksMax: 4, mentorHours: 2,
      price: 7999, seniorPrice: 9999, principalPrice: 12999, ratingAvg: 4.6, ratingCount: 42,
      rubricName: "Sprint rubric", criteria: [
        { name: "Correctness", description: "Handles the held-out payment edge cases", weightPct: 50 },
        { name: "Code quality", description: "Structure, tests, readability", weightPct: 30 },
        { name: "Communication", description: "Clear write-up and tradeoffs", weightPct: 20 },
      ],
      milestones: [
        { title: "API & data model", text: "Design endpoints, schema and idempotency strategy", week: 1, weightPct: 40 },
        { title: "Payments & webhooks", text: "Integrate provider, handle retries and webhook races", week: 2, weightPct: 40 },
        { title: "Hardening & tests", text: "Edge cases, failure modes, test coverage", week: 3, weightPct: 20 },
      ],
    },
    {
      tenantSlug: "demo-academy", slug: "distributed-rate-limiter", title: "Distributed Rate Limiter", tier: "CAPSTONE",
      summary: "Build a horizontally-scalable rate limiter with multiple algorithms and a control plane.",
      categorySlug: "system-design", techStack: ["go", "redis", "grpc"], weeksMin: 4, weeksMax: 8, mentorHours: 4,
      price: 19999, seniorPrice: 24999, principalPrice: 29999, ratingAvg: 4.9, ratingCount: 58,
      rubricName: "Systems rubric", criteria: [
        { name: "Correctness", description: "Meets the held-out evaluation under load", weightPct: 40 },
        { name: "Scalability", description: "Behaviour under concurrency and failure", weightPct: 30 },
        { name: "Code quality", description: "Structure, tests, readability", weightPct: 30 },
      ],
      milestones: [
        { title: "Algorithm design", text: "Token bucket vs sliding window; data-flow doc", week: 1, weightPct: 20 },
        { title: "Distributed core", text: "Redis-backed counters that converge across nodes", week: 3, weightPct: 40 },
        { title: "Control plane & hardening", text: "Config API, metrics, chaos tests", week: 6, weightPct: 40 },
      ],
    },
    {
      tenantSlug: "datawicket", slug: "ml-recommender", title: "ML Recommendation Engine", tier: "CAPSTONE",
      summary: "Build and evaluate a production recommender with offline metrics and an online serving path.",
      categorySlug: "data-science-ai", techStack: ["python", "pytorch", "fastapi"], weeksMin: 4, weeksMax: 8, mentorHours: 4,
      price: 21999, seniorPrice: 26999, principalPrice: 31999, ratingAvg: 4.7, ratingCount: 33,
      rubricName: "ML rubric", criteria: [
        { name: "Model quality", description: "Offline metrics on the held-out set", weightPct: 40 },
        { name: "Engineering", description: "Serving path, latency, reproducibility", weightPct: 30 },
        { name: "Analysis", description: "Error analysis and honest evaluation", weightPct: 30 },
      ],
      milestones: [
        { title: "Data & baseline", text: "EDA, leakage checks, a simple baseline", week: 1, weightPct: 30 },
        { title: "Model & evaluation", text: "Train, tune and evaluate rigorously", week: 3, weightPct: 40 },
        { title: "Serving & write-up", text: "FastAPI serving, latency, final report", week: 6, weightPct: 30 },
      ],
    },
  ];

  for (const p of PROJECTS) {
    const t = tenantBySlug[p.tenantSlug];
    const rubric = await ensureRubric(t.id, p.rubricName, p.criteria);
    const project = await db.project.upsert({
      where: { tenantId_slug: { tenantId: t.id, slug: p.slug } },
      update: { ratingAvg: p.ratingAvg, ratingCount: p.ratingCount, status: "PUBLISHED" },
      create: {
        tenantId: t.id,
        createdById: t.creatorId,
        title: p.title,
        slug: p.slug,
        tier: p.tier,
        summary: p.summary,
        brief: doc(`${p.summary} The brief is deliberately incomplete — you make and justify the tradeoffs.`),
        techStack: p.techStack,
        categoryId: catBySlug[p.categorySlug],
        durationWeeksMin: p.weeksMin,
        durationWeeksMax: p.weeksMax,
        mentorHoursBudget: p.mentorHours,
        status: "PUBLISHED",
        rubricId: rubric.id,
        heldOutEvalConfig: { harness: "private-suite", cases: 20 },
        defenseRequired: p.tier !== "SPRINT",
        outcomes: ["A reviewed, portfolio-ready build"],
        publishedAt: daysAgo(90),
        ratingAvg: p.ratingAvg,
        ratingCount: p.ratingCount,
      },
    });
    // Milestones
    if ((await db.milestone.count({ where: { projectId: project.id } })) === 0) {
      for (const [i, m] of p.milestones.entries()) {
        await db.milestone.create({
          data: {
            projectId: project.id,
            title: m.title,
            description: doc(m.text),
            position: i,
            expectedWeek: m.week,
            deliverables: { items: ["repo", "write-up"] },
            isReviewCheckpoint: true,
            weightPct: m.weightPct,
          },
        });
      }
    }
    // Prices (base + mentor-level variants)
    if (!(await db.price.findFirst({ where: { projectId: project.id, currency: INR, region: null, mentorLevel: null } }))) {
      await db.price.createMany({
        data: [
          { itemType: "PROJECT", projectId: project.id, currency: INR, amountMinor: paise(p.price) },
          { itemType: "PROJECT", projectId: project.id, currency: INR, amountMinor: paise(p.seniorPrice), mentorLevel: "SENIOR" },
          { itemType: "PROJECT", projectId: project.id, currency: INR, amountMinor: paise(p.principalPrice), mentorLevel: "PRINCIPAL" },
        ],
      });
    }
    catalog[p.slug] = { kind: "PROJECT", id: project.id, tenantId: t.id, tenantSlug: p.tenantSlug, title: p.title, unitMinor: paise(p.price) };
  }

  // Reference existing base project
  const rtc = await db.project.findFirst({ where: { slug: "realtime-collab-editor", tenantId: demoTenant.id } });
  if (rtc) {
    await db.project.update({ where: { id: rtc.id }, data: { ratingAvg: 4.9, ratingCount: 47 } });
    catalog["realtime-collab-editor"] = { kind: "PROJECT", id: rtc.id, tenantId: demoTenant.id, tenantSlug: "demo-academy", title: rtc.title, unitMinor: paise(19999) };
  }

  console.log(`  ✓ Catalog: ${COURSES.length} new courses, ${PROJECTS.length} new projects (+ 2 creator tenants, 3 mentors)`);

  // ─────────────────────────────────────────────────────────────────────
  // Enrollments with varied progress ("Continue learning")
  // ─────────────────────────────────────────────────────────────────────
  const COURSE_SLUGS = [
    "fullstack-nextjs", "api-design-essentials", "python-data-analysis", "docker-kubernetes",
    "system-design-interview", "react-native-zero", "typescript-deep-dive", "ethical-hacking",
    "ml-foundations", "sql-mastery",
  ];

  const ensureEnrollment = async (
    userId: string,
    slug: string,
    progressPct: number,
    source: "PURCHASE" | "SUBSCRIPTION" | "FREE" | "ADMIN_GRANT",
    lastActivityAt: Date | null,
    cohortId: string | null = null,
  ) => {
    const entry = catalog[slug];
    if (!entry) return null;
    const existing = await db.enrollment.findFirst({ where: { userId, courseId: entry.id, cohortId } });
    const completed = progressPct >= 100;
    const data = {
      status: (completed ? "COMPLETED" : "ACTIVE") as "COMPLETED" | "ACTIVE",
      progressPct,
      lastActivityAt: lastActivityAt ?? undefined,
      completedAt: completed ? daysAgo(3) : null,
    };
    if (existing) {
      return db.enrollment.update({ where: { id: existing.id }, data });
    }
    return db.enrollment.create({
      data: {
        userId,
        courseId: entry.id,
        cohortId,
        source,
        activatedAt: daysAgo(40),
        ...data,
      },
    });
  };

  let enrollCount = 0;
  const sources = ["PURCHASE", "FREE", "SUBSCRIPTION"] as const;
  for (const [i, l] of LEARNERS.entries()) {
    const uid = learnerUsers[l.email].id;
    const picks = [COURSE_SLUGS[i % 10], COURSE_SLUGS[(i + 4) % 10], COURSE_SLUGS[(i + 7) % 10]];
    const progresses = [
      (i * 17 + 10) % 101,
      (i * 31) % 101,
      i % 3 === 0 ? 100 : (i * 13 + 55) % 101,
    ];
    for (let j = 0; j < 3; j++) {
      await ensureEnrollment(uid, picks[j], progresses[j], sources[j], daysAgo((i * 2 + j) % 20));
      enrollCount++;
    }
  }

  // arjun — the viewed dashboard: multiple enrollments with progress + a completed course
  await ensureEnrollment(arjun.id, "fullstack-nextjs", 45, "PURCHASE", daysAgo(1));
  await ensureEnrollment(arjun.id, "docker-kubernetes", 70, "SUBSCRIPTION", daysAgo(2));
  await ensureEnrollment(arjun.id, "python-data-analysis", 20, "FREE", daysAgo(5));
  // his base ORG_LICENSE api-design enrollment → completed (for a credential)
  {
    const e = await db.enrollment.findFirst({ where: { userId: arjun.id, courseId: catalog["api-design-essentials"].id } });
    if (e) await db.enrollment.update({ where: { id: e.id }, data: { progressPct: 100, status: "COMPLETED", completedAt: daysAgo(6), lastActivityAt: daysAgo(6) } });
  }

  // A few completions used by credentials below
  await ensureEnrollment(learnerUsers["vikram@learner.test"].id, "fullstack-nextjs", 100, "PURCHASE", daysAgo(4));
  await ensureEnrollment(learnerUsers["isha@learner.test"].id, "api-design-essentials", 100, "PURCHASE", daysAgo(8));
  await ensureEnrollment(learnerUsers["sana@learner.test"].id, "python-data-analysis", 100, "SUBSCRIPTION", daysAgo(9));
  await ensureEnrollment(learnerUsers["karan@learner.test"].id, "typescript-deep-dive", 88, "PURCHASE", daysAgo(11));
  // enterprise/nalanda learners get a couple marketplace enrollments too
  await ensureEnrollment(sneha.id, "typescript-deep-dive", 55, "SUBSCRIPTION", daysAgo(3));
  await ensureEnrollment(aditi.id, "sql-mastery", 100, "FREE", daysAgo(7));
  await ensureEnrollment(rahul.id, "docker-kubernetes", 35, "FREE", daysAgo(6));

  console.log(`  ✓ Enrollments: ~${enrollCount + 11} learner enrollments with varied progress`);

  // ─────────────────────────────────────────────────────────────────────
  // Gamification: XP events, streaks, badges  (PRIORITY)
  // ─────────────────────────────────────────────────────────────────────
  const badges = await db.badge.findMany({ select: { id: true, code: true } });
  const badgeByCode: Record<string, string> = Object.fromEntries(badges.map((b) => [b.code, b.id]));

  const xpBreakdown = (total: number): Array<{ kind: string; points: number }> => {
    const out: Array<{ kind: string; points: number }> = [];
    let rem = total;
    const take = (kind: string, points: number, maxCount: number) => {
      let c = 0;
      while (rem >= points && c < maxCount) { out.push({ kind, points }); rem -= points; c++; }
    };
    take("PROJECT_PASSED", 300, 2);
    take("COURSE_COMPLETED", 200, 4);
    take("QUIZ_PASSED", 50, 8);
    take("DISCUSSION_ACCEPTED", 40, 4);
    take("LESSON_COMPLETED", 25, 40);
    take("STREAK_DAY", 10, 40);
    if (rem > 0) out.push({ kind: "XP_BONUS", points: rem });
    return out;
  };

  const seedGamification = async (userId: string, xp: number, cur: number, long: number, badgeCodes: string[]) => {
    // XP events (idempotent per user via refType marker)
    const hasXp = await db.xpEvent.findFirst({ where: { userId, refType: "SEED_XP" } });
    if (!hasXp) {
      const events = xpBreakdown(xp);
      await db.xpEvent.createMany({
        data: events.map((e, idx) => ({
          userId,
          kind: e.kind,
          points: e.points,
          refType: "SEED_XP",
          refId: `${userId}#${idx}`,
          occurredAt: daysAgo((idx * 3) % 45),
        })),
      });
    }
    // Streak (upsert on unique userId)
    await db.userStreak.upsert({
      where: { userId },
      update: { currentDays: cur, longestDays: long, lastActivityDate: daysAgo(cur > 0 ? 0 : 2) },
      create: { userId, currentDays: cur, longestDays: long, lastActivityDate: daysAgo(cur > 0 ? 0 : 2) },
    });
    // Badges (upsert on unique [badgeId, userId])
    for (const code of badgeCodes) {
      const badgeId = badgeByCode[code];
      if (!badgeId) continue;
      await db.userBadge.upsert({
        where: { badgeId_userId: { badgeId, userId } },
        update: {},
        create: { badgeId, userId, awardedAt: daysAgo(20), context: { via: "seed" } },
      });
    }
  };

  for (const l of LEARNERS) {
    await seedGamification(learnerUsers[l.email].id, l.xp, l.cur, l.long, l.badges);
  }
  // arjun: strong-but-not-#1 (rank ~3), ~15-day streak, several badges
  await seedGamification(arjun.id, 3120, 15, 22, ["first-lesson", "first-course", "streak-7", "first-project"]);
  // more leaderboard depth from enterprise/nalanda users
  await seedGamification(sneha.id, 1100, 6, 12, ["first-lesson", "first-course"]);
  await seedGamification(aditi.id, 1500, 24, 24, ["first-lesson", "first-course", "streak-7"]);
  await seedGamification(rahul.id, 900, 4, 9, ["first-lesson"]);
  await seedGamification(zoya.id, 700, 3, 6, ["first-lesson"]);

  console.log(`  ✓ Gamification: XP for ${LEARNERS.length + 5} users, streaks + badge awards`);

  // ─────────────────────────────────────────────────────────────────────
  // Catalog reviews (PUBLISHED, 4–5 stars, real bodies)
  // ─────────────────────────────────────────────────────────────────────
  const ensureCourseReview = async (userId: string, slug: string, rating: number, title: string, body: string) => {
    const entry = catalog[slug];
    if (!entry || entry.kind !== "COURSE") return;
    await db.catalogReview.upsert({
      where: { userId_courseId: { userId, courseId: entry.id } },
      update: { rating, title, body, status: "PUBLISHED" },
      create: { userId, courseId: entry.id, rating, title, body, status: "PUBLISHED", createdAt: daysAgo(15) },
    });
  };
  const ensureProjectReview = async (userId: string, slug: string, rating: number, title: string, body: string) => {
    const entry = catalog[slug];
    if (!entry || entry.kind !== "PROJECT") return;
    await db.catalogReview.upsert({
      where: { userId_projectId: { userId, projectId: entry.id } },
      update: { rating, title, body, status: "PUBLISHED" },
      create: { userId, projectId: entry.id, rating, title, body, status: "PUBLISHED", createdAt: daysAgo(12) },
    });
  };

  const courseReviews: Array<[string, string, number, string, string]> = [
    ["ananya@learner.test", "fullstack-nextjs", 5, "Best practical course I've taken", "Built a real SaaS end to end. The payments module alone was worth it."],
    ["vikram@learner.test", "fullstack-nextjs", 5, "Production-grade, not toy examples", "Loved that it covers deployment and edge cases, not just happy paths."],
    ["isha@learner.test", "api-design-essentials", 4, "Concise and pragmatic", "Great for teams. Versioning chapter cleared up a lot of confusion."],
    ["sana@learner.test", "python-data-analysis", 5, "Clicked instantly", "The datasets are realistic and the pandas patterns stuck with me."],
    ["rohit@learner.test", "docker-kubernetes", 5, "Finally understand k8s", "The rollout and networking sections are gold."],
    ["diya@learner.test", "typescript-deep-dive", 5, "Generics finally make sense", "The mental models here are excellent. Highly recommend."],
    ["karan@learner.test", "typescript-deep-dive", 4, "Dense but rewarding", "Take your time with the exercises and it pays off."],
    ["nikita@learner.test", "system-design-interview", 5, "Landed my offer", "Capacity estimation drills were exactly what I needed."],
    ["aryan@learner.test", "sql-mastery", 5, "Window functions demystified", "Query tuning section changed how I write SQL."],
    ["tanvi@learner.test", "ml-foundations", 4, "Rigorous and honest", "Appreciated the focus on evaluation and avoiding leakage."],
    ["farhan@learner.test", "react-native-zero", 4, "Shipped my first app", "Clear, hands-on, and up to date with Expo."],
    ["pooja@learner.test", "ethical-hacking", 5, "Hands-on from day one", "The labs are safe, guided and genuinely fun."],
  ];
  for (const [email, slug, rating, title, body] of courseReviews) {
    await ensureCourseReview(learnerUsers[email].id, slug, rating, title, body);
  }
  await ensureProjectReview(learnerUsers["ananya@learner.test"].id, "realtime-collab-editor", 5, "The mentor review made it", "Ambiguous brief pushed me to make real decisions. Feedback was sharp.");
  await ensureProjectReview(learnerUsers["rohit@learner.test"].id, "distributed-rate-limiter", 5, "Interview-ready portfolio piece", "Exactly the kind of systems work employers ask about.");
  await ensureProjectReview(arjun.id, "checkout-service", 4, "Great sprint", "Tight scope, strong feedback on idempotency and retries.");

  console.log(`  ✓ Catalog reviews: ${courseReviews.length + 3} published (4–5★)`);

  // ─────────────────────────────────────────────────────────────────────
  // Cohorts + upcoming live sessions ("Next live")
  // ─────────────────────────────────────────────────────────────────────
  const ensureCohort = async (slug: string, cohortSlug: string, name: string, status: "OPEN" | "RUNNING", startsAt: Date, endsAt: Date | null, capacity: number) => {
    const entry = catalog[slug];
    if (!entry) return null;
    return db.cohort.upsert({
      where: { courseId_slug: { courseId: entry.id, slug: cohortSlug } },
      update: { status },
      create: { courseId: entry.id, name, slug: cohortSlug, startsAt, endsAt, status, capacity, enrollmentClosesAt: daysFromNow(2) },
    });
  };

  const fsRunning = await ensureCohort("fullstack-nextjs", "jul-2026", "July 2026 Live Cohort", "RUNNING", daysAgo(14), daysFromNow(42), 40);
  const dkRunning = await ensureCohort("docker-kubernetes", "dk8s-jul-2026", "DevOps July Cohort", "RUNNING", daysAgo(7), daysFromNow(49), 35);
  const sdOpen = await ensureCohort("system-design-interview", "sysd-sep-2026", "September Interview Sprint", "OPEN", daysFromNow(30), daysFromNow(75), 50);

  // enroll arjun + a few learners into the running fullstack cohort so "Next live" shows
  if (fsRunning) {
    await ensureEnrollment(arjun.id, "fullstack-nextjs", 45, "PURCHASE", daysAgo(1), fsRunning.id);
    await ensureEnrollment(learnerUsers["ananya@learner.test"].id, "fullstack-nextjs", 62, "PURCHASE", daysAgo(2), fsRunning.id);
    await ensureEnrollment(learnerUsers["rohit@learner.test"].id, "fullstack-nextjs", 40, "SUBSCRIPTION", daysAgo(3), fsRunning.id);
  }

  const ensureLive = async (
    ref: string,
    tenantId: string,
    hostUserId: string,
    purpose: "COHORT_CLASS" | "WEBINAR" | "AMA" | "MENTOR_CHECKPOINT",
    title: string,
    startAt: Date,
    durationMin: number,
    opts: { courseId?: string; cohortId?: string; projectInstanceId?: string } = {},
  ) => {
    if (await db.liveSession.findFirst({ where: { providerSessionRef: ref } })) return;
    await db.liveSession.create({
      data: {
        tenantId,
        purpose,
        title,
        description: `${title} — join live.`,
        scheduledStartAt: startAt,
        scheduledEndAt: new Date(startAt.getTime() + durationMin * 60_000),
        provider: "EXTERNAL_LINK",
        providerSessionRef: ref,
        joinUrl: "https://live.example.test/" + ref,
        hostUserId,
        status: "SCHEDULED",
        ...opts,
      },
    });
  };

  await ensureLive("seed-live-1", demoTenant.id, cora.id, "COHORT_CLASS", "Auth deep-dive & session security", daysFromNow(3), 90, { courseId: catalog["fullstack-nextjs"].id, cohortId: fsRunning?.id });
  await ensureLive("seed-live-2", demoTenant.id, cora.id, "COHORT_CLASS", "Office hours: payments & webhooks", daysFromNow(7), 60, { courseId: catalog["fullstack-nextjs"].id, cohortId: fsRunning?.id });
  await ensureLive("seed-live-3", demoTenant.id, mentorRithvik.id, "AMA", "AMA: breaking into distributed systems", daysFromNow(6), 60, {});
  await ensureLive("seed-live-4", demoTenant.id, cora.id, "COHORT_CLASS", "Kubernetes networking lab", daysFromNow(5), 90, { courseId: catalog["docker-kubernetes"].id, cohortId: dkRunning?.id });
  await ensureLive("seed-live-5", demoTenant.id, cora.id, "WEBINAR", "Webinar: scaling to your first million users", daysFromNow(10), 75, { courseId: catalog["system-design-interview"].id, cohortId: sdOpen?.id });

  console.log("  ✓ Cohorts (2 RUNNING, 1 OPEN) + 5 upcoming live sessions");

  // ─────────────────────────────────────────────────────────────────────
  // Discussion threads + replies on a course
  // ─────────────────────────────────────────────────────────────────────
  const seedThread = async (
    courseSlug: string,
    title: string,
    kind: "QUESTION" | "DISCUSSION",
    authorEmail: string,
    bodyText: string,
    replies: Array<{ email: string; text: string; accepted?: boolean }>,
  ) => {
    const entry = catalog[courseSlug];
    if (!entry) return;
    if (await db.discussionThread.findFirst({ where: { courseId: entry.id, title } })) return;
    const authorId = learnerUsers[authorEmail]?.id ?? arjun.id;
    const thread = await db.discussionThread.create({
      data: {
        scopeType: "COURSE",
        courseId: entry.id,
        authorId,
        title,
        body: doc(bodyText),
        kind,
        status: kind === "QUESTION" && replies.some((r) => r.accepted) ? "RESOLVED" : "OPEN",
        upvoteCount: 3 + replies.length,
        replyCount: replies.length,
        lastActivityAt: daysAgo(2),
      },
    });
    let acceptedPostId: string | null = null;
    for (const r of replies) {
      const post = await db.discussionPost.create({
        data: {
          threadId: thread.id,
          authorId: learnerUsers[r.email]?.id ?? cora.id,
          body: doc(r.text),
          isAccepted: !!r.accepted,
          upvoteCount: r.accepted ? 5 : 1,
          createdAt: daysAgo(3),
        },
      });
      if (r.accepted) acceptedPostId = post.id;
    }
    if (acceptedPostId) await db.discussionThread.update({ where: { id: thread.id }, data: { acceptedPostId } });
  };

  await seedThread("fullstack-nextjs", "How to handle server action errors gracefully?", "QUESTION", "rohit@learner.test",
    "My server actions throw and the UI just breaks. What's the recommended pattern for surfacing errors?", [
      { email: "ananya@learner.test", text: "Return a typed result object instead of throwing, then render the error branch.", accepted: true },
      { email: "vikram@learner.test", text: "Also wrap with an error boundary for the unexpected cases." },
    ]);
  await seedThread("fullstack-nextjs", "Prisma vs Drizzle for this stack?", "DISCUSSION", "diya@learner.test",
    "Curious what people are using for the data layer and why.", [
      { email: "karan@learner.test", text: "Prisma's DX is great and the course uses it, so I'd start there." },
      { email: "nikita@learner.test", text: "Drizzle is lighter if you want raw SQL control." },
      { email: "aryan@learner.test", text: "Started on Prisma, never needed to switch." },
    ]);
  await seedThread("fullstack-nextjs", "Connection pooling on Vercel + Postgres?", "QUESTION", "farhan@learner.test",
    "Getting too many connections in production. How are you all pooling?", [
      { email: "sana@learner.test", text: "Use a transaction pooler (pgbouncer/Supavisor) for the serverless runtime.", accepted: true },
    ]);

  console.log("  ✓ Discussion threads (3) with replies + accepted answers");

  // ─────────────────────────────────────────────────────────────────────
  // Orders + OrderItems + Payments (varied statuses) + ledger/payouts
  // ─────────────────────────────────────────────────────────────────────
  const platformAccount = await (async () => {
    const existing = await db.ledgerAccount.findFirst({ where: { ownerType: "PLATFORM", currency: INR } });
    return existing ?? db.ledgerAccount.create({ data: { ownerType: "PLATFORM", currency: INR } });
  })();
  const tenantAccount = async (tenantId: string) => {
    const existing = await db.ledgerAccount.findFirst({ where: { ownerType: "TENANT", tenantId, currency: INR } });
    return existing ?? db.ledgerAccount.create({ data: { ownerType: "TENANT", tenantId, currency: INR } });
  };
  const mentorAccount = async (mentorProfileId: string) => {
    const existing = await db.ledgerAccount.findFirst({ where: { ownerType: "MENTOR", mentorProfileId, currency: INR } });
    return existing ?? db.ledgerAccount.create({ data: { ownerType: "MENTOR", mentorProfileId, currency: INR } });
  };
  const ledgerEntry = async (accountId: string, entryType: string, amountMinor: bigint, idem: string, opts: Record<string, unknown> = {}) => {
    await db.ledgerEntry.upsert({
      where: { idempotencyKey: idem },
      update: {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: { accountId, entryType: entryType as any, amountMinor, currency: INR, idempotencyKey: idem, ...opts },
    });
  };

  type OrderSpec = { email: string; slug: string; status: "PAID" | "PENDING_PAYMENT" | "REFUNDED" | "FAILED"; ref: string; method: string; daysAgoPlaced: number };
  const ORDERS: OrderSpec[] = [
    { email: "arjun@acme.test", slug: "fullstack-nextjs", status: "PAID", ref: "pay_seed_arjun_fs", method: "upi", daysAgoPlaced: 20 },
    { email: "ananya@learner.test", slug: "system-design-interview", status: "PAID", ref: "pay_seed_ananya_sd", method: "card", daysAgoPlaced: 25 },
    { email: "vikram@learner.test", slug: "distributed-rate-limiter", status: "PAID", ref: "pay_seed_vikram_rl", method: "card", daysAgoPlaced: 18 },
    { email: "isha@learner.test", slug: "typescript-deep-dive", status: "PAID", ref: "pay_seed_isha_ts", method: "upi", daysAgoPlaced: 30 },
    { email: "rohit@learner.test", slug: "docker-kubernetes", status: "PAID", ref: "pay_seed_rohit_dk", method: "netbanking", daysAgoPlaced: 15 },
    { email: "sana@learner.test", slug: "python-data-analysis", status: "PAID", ref: "pay_seed_sana_py", method: "card", daysAgoPlaced: 12 },
    { email: "diya@learner.test", slug: "ml-foundations", status: "PAID", ref: "pay_seed_diya_ml", method: "upi", daysAgoPlaced: 10 },
    { email: "karan@learner.test", slug: "ethical-hacking", status: "PAID", ref: "pay_seed_karan_eh", method: "card", daysAgoPlaced: 9 },
    { email: "nikita@learner.test", slug: "sql-mastery", status: "PAID", ref: "pay_seed_nikita_sql", method: "upi", daysAgoPlaced: 8 },
    { email: "aryan@learner.test", slug: "react-native-zero", status: "PENDING_PAYMENT", ref: "pay_seed_aryan_rn", method: "card", daysAgoPlaced: 1 },
    { email: "farhan@learner.test", slug: "checkout-service", status: "FAILED", ref: "pay_seed_farhan_co", method: "card", daysAgoPlaced: 2 },
    { email: "tanvi@learner.test", slug: "typescript-deep-dive", status: "REFUNDED", ref: "pay_seed_tanvi_ts", method: "upi", daysAgoPlaced: 22 },
  ];

  let paidCount = 0;
  for (const o of ORDERS) {
    if (await db.payment.findFirst({ where: { provider: "RAZORPAY", providerPaymentRef: o.ref } })) continue;
    const entry = catalog[o.slug];
    if (!entry) continue;
    const user = learnerUsers[o.email] ?? { id: o.email === "arjun@acme.test" ? arjun.id : "" };
    const uid = o.email === "arjun@acme.test" ? arjun.id : user.id;
    if (!uid) continue;
    const commissionBps = 2000;
    const { base, tax, platformFee, sellerEarnings } = money(entry.unitMinor, commissionBps);
    const isPaid = o.status === "PAID" || o.status === "REFUNDED";
    const placedAt = daysAgo(o.daysAgoPlaced);

    const order = await db.order.create({
      data: {
        userId: uid,
        status: o.status,
        currency: INR,
        subtotalMinor: base,
        discountMinor: 0n,
        taxMinor: tax,
        totalMinor: entry.unitMinor,
        placedAt,
        paidAt: isPaid ? placedAt : null,
        billTo: { name: "Seed Buyer", email: o.email },
      },
    });
    const item = await db.orderItem.create({
      data: {
        orderId: order.id,
        itemType: entry.kind === "COURSE" ? "COURSE" : "PROJECT",
        courseId: entry.kind === "COURSE" ? entry.id : null,
        projectId: entry.kind === "PROJECT" ? entry.id : null,
        sellerTenantId: entry.tenantId,
        titleSnapshot: entry.title,
        unitAmountMinor: entry.unitMinor,
        taxMinor: tax,
        taxRateBps: 1800,
        totalMinor: entry.unitMinor,
        commissionBpsSnapshot: commissionBps,
        platformFeeMinor: platformFee,
        sellerEarningsMinor: sellerEarnings,
        refundWindowDays: 14,
        refundableUntil: new Date(placedAt.getTime() + 14 * 86_400_000),
        fulfillmentStatus: o.status === "PAID" ? "FULFILLED" : o.status === "REFUNDED" ? "REFUNDED" : "PENDING",
      },
    });
    const payment = await db.payment.create({
      data: {
        orderId: order.id,
        provider: "RAZORPAY",
        providerOrderRef: `order_${o.ref}`,
        providerPaymentRef: o.ref,
        method: o.method,
        amountMinor: entry.unitMinor,
        currency: INR,
        status: o.status === "PAID" ? "CAPTURED" : o.status === "REFUNDED" ? "REFUNDED" : o.status === "FAILED" ? "FAILED" : "CREATED",
        failureCode: o.status === "FAILED" ? "BANK_DECLINED" : null,
        failureMessage: o.status === "FAILED" ? "Payment declined by issuing bank" : null,
        capturedAt: isPaid ? placedAt : null,
      },
    });

    if (isPaid) {
      paidCount++;
      const acct = await tenantAccount(entry.tenantId);
      await ledgerEntry(acct.id, "SALE_EARNING", sellerEarnings, `seed-sale-${o.ref}`, { orderItemId: item.id, memo: `Sale: ${entry.title}` });
      await ledgerEntry(platformAccount.id, "PLATFORM_FEE", platformFee, `seed-fee-${o.ref}`, { orderItemId: item.id, memo: `Platform fee: ${entry.title}` });
    }
    if (o.status === "REFUNDED") {
      const refund = await db.refund.create({
        data: {
          paymentId: payment.id,
          orderItemId: item.id,
          kind: "ITEM",
          amountMinor: entry.unitMinor,
          currency: INR,
          reason: "WITHIN_WINDOW",
          note: "Refunded within the 14-day window",
          status: "PROCESSED",
          decidedAt: daysAgo(o.daysAgoPlaced - 2),
          processedAt: daysAgo(o.daysAgoPlaced - 2),
          providerRefundRef: `rfnd_${o.ref}`,
        },
      });
      const acct = await tenantAccount(entry.tenantId);
      await ledgerEntry(acct.id, "REFUND_REVERSAL", -sellerEarnings, `seed-refrev-${o.ref}`, { refundId: refund.id, orderItemId: item.id, memo: `Refund reversal: ${entry.title}` });
    }
  }

  // Mentor fee ledger entries (from passed/kickoff instances — attribution)
  const mpRithvikAcct = await mentorAccount(mpRithvik.id);
  const mpLakshmiAcct = await mentorAccount(mpLakshmi.id);
  await ledgerEntry(mpRithvikAcct.id, "MENTOR_FEE", paise(4400), "seed-mentorfee-rithvik-1", { memo: "Mentor fee: capstone review" });
  await ledgerEntry(mpRithvikAcct.id, "MENTOR_FEE", paise(4400), "seed-mentorfee-rithvik-2", { memo: "Mentor fee: capstone review" });
  await ledgerEntry(mpLakshmiAcct.id, "MENTOR_FEE", paise(5500), "seed-mentorfee-lakshmi-1", { memo: "Mentor fee: capstone review" });

  // Payouts (varied statuses) — deterministic via providerRef
  const ensurePayout = async (accountId: string, amount: bigint, status: string, method: string, ref: string, processed: boolean) => {
    if (await db.payout.findFirst({ where: { providerRef: ref } })) return;
    await db.payout.create({
      data: {
        accountId,
        amountMinor: amount,
        currency: INR,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: status as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        method: method as any,
        providerRef: ref,
        periodStart: daysAgo(45),
        periodEnd: daysAgo(15),
        processedAt: processed ? daysAgo(14) : null,
      },
    });
  };
  const demoAcct = await tenantAccount(demoTenant.id);
  const codecraftAcct = await tenantAccount(codecraft.id);
  await ensurePayout(demoAcct.id, paise(45000), "PAID", "BANK_TRANSFER", "seed-payout-demo-1", true);
  await ensurePayout(demoAcct.id, paise(28000), "PENDING_APPROVAL", "BANK_TRANSFER", "seed-payout-demo-2", false);
  await ensurePayout(codecraftAcct.id, paise(19000), "PROCESSING", "RAZORPAYX", "seed-payout-codecraft-1", false);
  await ensurePayout(mpRithvikAcct.id, paise(8800), "PAID", "UPI", "seed-payout-rithvik-1", true);
  await ensurePayout(mpLakshmiAcct.id, paise(5500), "DRAFT", "UPI", "seed-payout-lakshmi-1", false);

  console.log(`  ✓ Commerce: ${ORDERS.length} orders (${paidCount} paid), payments, refund, ledger + 5 payouts`);

  // ─────────────────────────────────────────────────────────────────────
  // Project instances at various statuses + submissions/reviews/mentors
  // ─────────────────────────────────────────────────────────────────────
  const ensureInstance = async (
    userEmail: string | "arjun",
    projectSlug: string,
    status: string,
    mentorProfileId: string,
    mentorLevel: "SENIOR" | "PRINCIPAL" | "ASSOCIATE",
    opts: { started?: number; kickoff?: number; finalScore?: number } = {},
  ) => {
    const entry = catalog[projectSlug];
    if (!entry || entry.kind !== "PROJECT") return null;
    const uid = userEmail === "arjun" ? arjun.id : learnerUsers[userEmail].id;
    let inst = await db.projectInstance.findFirst({ where: { userId: uid, projectId: entry.id, source: "PURCHASE" } });
    if (!inst) {
      inst = await db.projectInstance.create({
        data: {
          projectId: entry.id,
          userId: uid,
          source: "PURCHASE",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          status: status as any,
          requestedMentorLevel: mentorLevel,
          startedAt: opts.started != null ? daysAgo(opts.started) : null,
          mentorKickoffAt: opts.kickoff != null ? daysAgo(opts.kickoff) : null,
          dueAt: daysFromNow(21),
          completedAt: status === "PASSED" ? daysAgo(2) : null,
          finalScore: opts.finalScore ?? null,
          repoUrl: `https://github.com/seed/${projectSlug}-${uid.slice(-4)}`,
        },
      });
    }
    // Mentor assignment (idempotent)
    if (!(await db.mentorAssignment.findFirst({ where: { projectInstanceId: inst.id, mentorProfileId } }))) {
      await db.mentorAssignment.create({ data: { projectInstanceId: inst.id, mentorProfileId, role: "PRIMARY", assignedAt: daysAgo(opts.kickoff ?? 10) } });
    }
    return inst;
  };

  const milestonesFor = (projectId: string) => db.milestone.findMany({ where: { projectId }, orderBy: { position: "asc" } });
  const submitMilestone = async (
    instanceId: string,
    milestoneId: string,
    status: string,
    submittedDaysAgo: number,
  ) => {
    const existing = await db.milestoneSubmission.findFirst({ where: { projectInstanceId: instanceId, milestoneId, attemptNo: 1 } });
    if (existing) return existing;
    return db.milestoneSubmission.create({
      data: {
        projectInstanceId: instanceId,
        milestoneId,
        attemptNo: 1,
        notes: doc("Submission notes and decisions taken."),
        repoUrl: "https://github.com/seed/milestone",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: status as any,
        submittedAt: daysAgo(submittedDaysAgo),
      },
    });
  };
  const addReview = async (
    instanceId: string,
    milestoneSubmissionId: string | null,
    kind: string,
    reviewerId: string | null,
    status: string,
    decision: string | null,
    overallScore: number | null,
    turnaroundDays: number,
  ) => {
    const existing = await db.projectReview.findFirst({ where: { projectInstanceId: instanceId, kind: kind as never, milestoneSubmissionId } });
    if (existing) return existing;
    return db.projectReview.create({
      data: {
        projectInstanceId: instanceId,
        milestoneSubmissionId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        kind: kind as any,
        reviewerId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: status as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        decision: decision as any,
        overallScore,
        summary: doc(kind === "AI_FIRST_PASS" ? "Automated first-pass feedback on structure and tests." : "Mentor review: solid work with clear tradeoffs."),
        turnaroundTargetAt: daysFromNow(2),
        startedAt: status !== "PENDING" ? daysAgo(turnaroundDays + 1) : null,
        completedAt: status === "COMPLETED" ? daysAgo(turnaroundDays) : null,
      },
    });
  };

  // A) arjun — IN_PROGRESS on the capstone (his dashboard)
  const instArjun = await ensureInstance("arjun", "realtime-collab-editor", "IN_PROGRESS", mpRithvik.id, "SENIOR", { started: 8, kickoff: 8 });
  if (instArjun) {
    const ms = await milestonesFor(catalog["realtime-collab-editor"].id);
    if (ms[0]) await submitMilestone(instArjun.id, ms[0].id, "APPROVED", 5);
  }

  // B) vikram — IN_REVIEW with AI first-pass complete + mentor checkpoint pending
  const instVikram = await ensureInstance("vikram@learner.test", "realtime-collab-editor", "IN_REVIEW", mpRithvik.id, "SENIOR", { started: 20, kickoff: 20 });
  if (instVikram) {
    const ms = await milestonesFor(catalog["realtime-collab-editor"].id);
    if (ms[0]) await submitMilestone(instVikram.id, ms[0].id, "APPROVED", 16);
    let sub1 = null;
    if (ms[1]) sub1 = await submitMilestone(instVikram.id, ms[1].id, "IN_REVIEW", 3);
    await addReview(instVikram.id, sub1?.id ?? null, "AI_FIRST_PASS", null, "COMPLETED", "APPROVED", 82, 2);
    await addReview(instVikram.id, sub1?.id ?? null, "MENTOR_CHECKPOINT", mentorRithvik.id, "IN_PROGRESS", null, null, 1);
  }

  // C) isha — CHANGES_REQUESTED
  const instIsha = await ensureInstance("isha@learner.test", "realtime-collab-editor", "CHANGES_REQUESTED", mpLakshmi.id, "PRINCIPAL", { started: 24, kickoff: 24 });
  if (instIsha) {
    const ms = await milestonesFor(catalog["realtime-collab-editor"].id);
    let sub0 = null;
    if (ms[0]) sub0 = await submitMilestone(instIsha.id, ms[0].id, "CHANGES_REQUESTED", 6);
    await addReview(instIsha.id, sub0?.id ?? null, "MENTOR_CHECKPOINT", mentorLakshmi.id, "COMPLETED", "CHANGES_REQUESTED", 58, 4);
  }

  // D) ananya — PASSED with MENTOR_FINAL + rubric scores → PROJECT credential
  const instAnanya = await ensureInstance("ananya@learner.test", "realtime-collab-editor", "PASSED", mpRithvik.id, "SENIOR", { started: 45, kickoff: 45, finalScore: 88 });
  if (instAnanya) {
    const ms = await milestonesFor(catalog["realtime-collab-editor"].id);
    for (const [i, m] of ms.entries()) await submitMilestone(instAnanya.id, m.id, "APPROVED", 30 - i * 8);
    const lastSub = await db.milestoneSubmission.findFirst({ where: { projectInstanceId: instAnanya.id }, orderBy: { submittedAt: "desc" } });
    const finalReview = await addReview(instAnanya.id, lastSub?.id ?? null, "MENTOR_FINAL", mentorRithvik.id, "COMPLETED", "PASS", 88, 2);
    // Rubric scores on the final review
    if (finalReview) {
      const criteria = await db.rubricCriterion.findMany({ where: { rubric: { projects: { some: { id: catalog["realtime-collab-editor"].id } } } }, orderBy: { position: "asc" } });
      const scoreByPos = [35, 26, 27]; // Correctness/40, Code quality/30, Design judgment/30 → 88
      for (const [i, cr] of criteria.entries()) {
        await db.rubricScore.upsert({
          where: { projectReviewId_rubricCriterionId: { projectReviewId: finalReview.id, rubricCriterionId: cr.id } },
          update: {},
          create: {
            projectReviewId: finalReview.id,
            rubricCriterionId: cr.id,
            score: scoreByPos[i] ?? Math.round(cr.weightPct * 0.85),
            maxScore: cr.weightPct,
            comment: "Strong, well-justified work.",
          },
        });
      }
    }
  }

  // E) rohit — IN_PROGRESS on distributed rate limiter
  const instRohit = await ensureInstance("rohit@learner.test", "distributed-rate-limiter", "IN_PROGRESS", mpAditya.id, "ASSOCIATE", { started: 10, kickoff: 10 });
  if (instRohit) {
    const ms = await milestonesFor(catalog["distributed-rate-limiter"].id);
    if (ms[0]) await submitMilestone(instRohit.id, ms[0].id, "SUBMITTED", 2);
  }

  // A project-checkpoint live session tied to vikram's in-review instance
  if (instVikram) {
    await ensureLive("seed-live-6", demoTenant.id, mentorRithvik.id, "MENTOR_CHECKPOINT", "Checkpoint review: sync architecture", daysFromNow(2), 45, { projectInstanceId: instVikram.id });
  }

  console.log("  ✓ Project instances: IN_PROGRESS / IN_REVIEW / CHANGES_REQUESTED / PASSED (+ rubric scores, mentor assignments)");

  // ─────────────────────────────────────────────────────────────────────
  // Credentials (COURSE + PROJECT, valid + one revoked)
  // ─────────────────────────────────────────────────────────────────────
  const ensureCourseCredential = async (userId: string, courseSlug: string, code: string, grade: string, revoked = false) => {
    const entry = catalog[courseSlug];
    if (!entry) return;
    const existing = await db.credential.findFirst({ where: { verificationCode: code } });
    if (existing) return;
    await db.credential.create({
      data: {
        userId,
        kind: "COURSE",
        courseId: entry.id,
        title: entry.title,
        grade,
        verificationCode: code,
        issuedAt: daysAgo(6),
        revokedAt: revoked ? daysAgo(1) : null,
        revokeReason: revoked ? "Issued in error — superseded by a re-issue" : null,
        metadata: { via: "seed" },
      },
    });
  };
  const ensureProjectCredential = async (userId: string, projectInstanceId: string, title: string, code: string, grade: string) => {
    const existing = await db.credential.findFirst({ where: { verificationCode: code } });
    if (existing) return;
    await db.credential.create({
      data: {
        userId,
        kind: "PROJECT",
        projectInstanceId,
        title,
        grade,
        verificationCode: code,
        issuedAt: daysAgo(2),
        metadata: { via: "seed" },
      },
    });
  };

  await ensureCourseCredential(arjun.id, "api-design-essentials", "AC-ARJ-API-7Q2K", "Distinction");
  await ensureCourseCredential(learnerUsers["vikram@learner.test"].id, "fullstack-nextjs", "AC-VIK-FS-9K3M", "Distinction");
  await ensureCourseCredential(learnerUsers["isha@learner.test"].id, "api-design-essentials", "AC-ISH-API-2L8P", "Merit");
  await ensureCourseCredential(learnerUsers["sana@learner.test"].id, "python-data-analysis", "AC-SAN-PY-5R1T", "Distinction");
  await ensureCourseCredential(learnerUsers["karan@learner.test"].id, "typescript-deep-dive", "AC-KAR-TS-0X4W", "Merit", true); // revoked
  if (instAnanya) await ensureProjectCredential(learnerUsers["ananya@learner.test"].id, instAnanya.id, "Real-Time Collaborative Editor", "PJ-ANY-RTC-3M6H", "Distinction");

  console.log("  ✓ Credentials: 5 course (1 revoked) + 1 project, unique verification codes");

  // ─────────────────────────────────────────────────────────────────────
  // Enterprise depth: roster, seats, consumptions, program enrollments
  // ─────────────────────────────────────────────────────────────────────
  const acmeOrg = await db.organization.findUniqueOrThrow({ where: { slug: "acme" } });
  const nalandaOrg = await db.organization.findUniqueOrThrow({ where: { slug: "nalanda" } });
  const acmeCatalog = await db.orgLicense.findFirstOrThrow({ where: { contractRef: "SEED-ACME-CATALOG" } });
  const acmePool = await db.orgLicense.findFirstOrThrow({ where: { contractRef: "SEED-ACME-POOL" } });
  const nalandaLicense = await db.orgLicense.findFirstOrThrow({ where: { contractRef: "SEED-NALANDA-PROGRAM" } });

  // New Acme roster members + seats
  const naveen = await ensureUser("naveen@acme.test", "Naveen Iyer");
  const divya = await ensureUser("divya@acme.test", "Divya Nair");
  await ensureMember(acmeOrg.id, naveen.id, "member");
  await ensureMember(acmeOrg.id, divya.id, "member");

  const ensureSeat = async (licenseId: string, userId: string | null, inviteEmail: string | null, status: "ACTIVATED" | "INVITED" | "REVOKED") => {
    const existing = userId
      ? await db.licenseSeat.findFirst({ where: { licenseId, userId } })
      : await db.licenseSeat.findFirst({ where: { licenseId, userId: null, inviteEmail } });
    if (existing) return existing;
    return db.licenseSeat.create({
      data: {
        licenseId,
        userId,
        inviteEmail,
        status,
        activatedAt: status === "ACTIVATED" ? daysAgo(20) : null,
        revokedAt: status === "REVOKED" ? daysAgo(5) : null,
      },
    });
  };
  await ensureSeat(acmeCatalog.id, naveen.id, null, "ACTIVATED");
  await ensureSeat(acmeCatalog.id, divya.id, null, "INVITED");
  await ensureSeat(acmeCatalog.id, null, "tarun@acme.test", "INVITED");
  await ensureSeat(acmeCatalog.id, null, "leela@acme.test", "INVITED");

  // Credit-pool consumptions for new acme users (idempotent via unique [licenseId,userId,courseId])
  const consumePool = async (userId: string, courseSlug: string) => {
    const entry = catalog[courseSlug];
    if (!entry) return;
    const existing = await db.licenseConsumption.findFirst({ where: { licenseId: acmePool.id, userId, courseId: entry.id } });
    if (existing) return;
    const price = await db.price.findFirst({ where: { courseId: entry.id, currency: INR, region: null } });
    const enr = await db.enrollment.findFirst({ where: { userId, courseId: entry.id, cohortId: null } })
      ?? await db.enrollment.create({ data: { userId, courseId: entry.id, source: "ORG_LICENSE", orgLicenseId: acmePool.id, progressPct: 30, lastActivityAt: daysAgo(4), expiresAt: acmePool.endsAt } });
    await db.licenseConsumption.create({
      data: { licenseId: acmePool.id, userId, itemType: "COURSE", courseId: entry.id, amountMinor: price?.amountMinor ?? paise(2999), enrollmentId: enr.id },
    });
  };
  await consumePool(naveen.id, "docker-kubernetes");
  await consumePool(divya.id, "system-design-interview");
  await consumePool(arjun.id, "fullstack-nextjs");

  // New Nalanda students + program enrollments with progress (fan-out course enrollment)
  const nalandaProgram = await db.program.findFirstOrThrow({ where: { slug: "applied-se-cert" } });
  const nalandaRunning = await db.programCohort.findFirstOrThrow({ where: { programId: nalandaProgram.id, status: "RUNNING" } });
  const nalandaItems = await db.programItem.findMany({ where: { programId: nalandaProgram.id }, orderBy: { position: "asc" } });

  const ishaan = await ensureUser("ishaan@nalanda.test", "Ishaan Malhotra");
  const riya = await ensureUser("riya@nalanda.test", "Riya Kapoor");
  await ensureMember(nalandaOrg.id, ishaan.id, "member");
  await ensureMember(nalandaOrg.id, riya.id, "member");

  const enrollProgramStudent = async (userId: string, progressPct: number) => {
    const seat = await ensureSeat(nalandaLicense.id, userId, null, "ACTIVATED");
    const pe = await db.programEnrollment.upsert({
      where: { programCohortId_userId: { programCohortId: nalandaRunning.id, userId } },
      update: {},
      create: { programCohortId: nalandaRunning.id, userId, licenseSeatId: seat.id, status: progressPct >= 100 ? "COMPLETED" : "IN_PROGRESS", completedAt: progressPct >= 100 ? daysAgo(2) : null },
    });
    for (const item of nalandaItems) {
      if (item.itemType === "COURSE" && item.courseId) {
        const existing = await db.enrollment.findFirst({ where: { userId, courseId: item.courseId, cohortId: null } });
        if (!existing) {
          await db.enrollment.create({ data: { userId, courseId: item.courseId, source: "PROGRAM", programEnrollmentId: pe.id, progressPct, status: progressPct >= 100 ? "COMPLETED" : "ACTIVE", lastActivityAt: daysAgo(3) } });
        }
      }
      if (item.itemType === "PROJECT" && item.projectId) {
        const existing = await db.projectInstance.findFirst({ where: { userId, projectId: item.projectId, programEnrollmentId: pe.id } });
        if (!existing) {
          await db.projectInstance.create({ data: { projectId: item.projectId, userId, source: "PROGRAM", programEnrollmentId: pe.id, status: "IN_PROGRESS", startedAt: daysAgo(15) } });
        }
      }
    }
    return pe;
  };
  await enrollProgramStudent(ishaan.id, 30);
  await enrollProgramStudent(riya.id, 80);

  console.log("  ✓ Enterprise depth: +4 members, seats (ACTIVATED/INVITED), pool consumptions, +2 program enrollments");

  // ─────────────────────────────────────────────────────────────────────
  // Portfolio profile for the viewed learner + top learners (nice-to-have)
  // ─────────────────────────────────────────────────────────────────────
  const ensurePortfolio = async (userId: string, slug: string, headline: string, visibility: "PUBLIC" | "UNLISTED") =>
    db.portfolioProfile.upsert({
      where: { userId },
      update: {},
      create: { userId, slug, headline, about: doc(headline), visibility, talentOptIn: visibility === "PUBLIC" },
    });
  await ensurePortfolio(arjun.id, "arjun-rao", "Backend engineer • building in public", "PUBLIC");
  await ensurePortfolio(learnerUsers["ananya@learner.test"].id, "ananya-desai", "Full-stack engineer • realtime & infra", "PUBLIC");

  console.log("✓ Complex mock data enrichment complete.");
}
