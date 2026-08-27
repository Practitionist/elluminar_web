// Complex, realistic mock data enrichment for populated dashboards.
//
// Everything here is IDEMPOTENT: keyed by deterministic slugs/emails/composite
// uniques or synthetic dedup refs, so re-running never duplicates and never
// deletes/overwrites base-seed data destructively.
//
// Money is BigInt minor units (paise). Percentages are basis points.

import type { Prisma, PrismaClient } from "../../src/generated/prisma/client";

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

/**
 * Hand-written question banks for courses where a real, demo-quality quiz
 * matters more than filler. Keyed by course slug; anything not listed falls
 * back to the generic three-question check below.
 *
 * Deliberately no CODE_OUTPUT questions: the type exists in the enum but
 * `submitQuizAttempt` has no execution path for it, so one would silently
 * score zero.
 */
const RICH_QUIZZES: Record<
  string,
  {
    title: string;
    instructions: string;
    passPct: number;
    timeLimitSec: number;
    questions: Array<Record<string, unknown>>;
  }
> = {
  "system-design-interview": {
    title: "Scaling, consistency and failure",
    instructions:
      "Nine questions on the trade-offs that actually come up in interviews. 70% to pass, unlimited attempts — retry until it sticks.",
    passPct: 70,
    timeLimitSec: 1200,
    questions: [
      {
        type: "SINGLE_CHOICE",
        prompt: { text: "During a network partition, CAP says a distributed store must give up one of consistency or availability. What does a CP system do when a replica can't reach its quorum?" },
        options: { choices: ["Serve possibly stale data", "Refuse the request", "Silently queue the write", "Promote itself to leader"] },
        correct: { index: 1 },
        points: 2,
        explanation: "A CP system sacrifices availability: it returns an error rather than answer from a replica it can't confirm is current.",
        position: 0,
      },
      {
        type: "MULTI_CHOICE",
        prompt: { text: "Reads on a product page are slow. Which of these genuinely reduce read latency?" },
        options: { choices: ["A read-through cache in front of the DB", "A covering index for the query", "Raising the connection pool size", "A read replica in the same region as the user"] },
        correct: { indexes: [0, 1, 3] },
        points: 3,
        explanation: "Pool size governs concurrency, not per-query latency — a bigger pool under the same slow query just queues more work.",
        position: 1,
      },
      {
        type: "TRUE_FALSE",
        prompt: { text: "With at-least-once delivery, a consumer must be idempotent to be correct." },
        options: { choices: ["True", "False"] },
        correct: { index: 0 },
        points: 1,
        explanation: "At-least-once means duplicates are expected, so applying the same message twice must be harmless.",
        position: 2,
      },
      {
        type: "SHORT_TEXT",
        prompt: { text: "One word: the property that lets a payment webhook be safely retried without double-charging." },
        options: {},
        correct: { text: "idempotency" },
        points: 2,
        explanation: "Idempotency — usually enforced with a client-supplied key the server deduplicates on.",
        position: 3,
      },
      {
        type: "SINGLE_CHOICE",
        prompt: { text: "You shard users by `hash(user_id)`. Which query becomes expensive?" },
        options: { choices: ["Fetch one user by id", "Update one user's email", "List all users created last week", "Delete one user"] },
        correct: { index: 2 },
        points: 2,
        explanation: "Anything not keyed by the shard key becomes a scatter-gather across every shard.",
        position: 4,
      },
      {
        type: "TRUE_FALSE",
        prompt: { text: "Adding a read replica gives you stronger consistency." },
        options: { choices: ["True", "False"] },
        correct: { index: 1 },
        points: 1,
        explanation: "The opposite: async replication introduces lag, so a replica can serve data the primary has already moved past.",
        position: 5,
      },
      {
        type: "MULTI_CHOICE",
        prompt: { text: "A cache key expires and thousands of requests hit the database at once. Which mitigations address this?" },
        options: { choices: ["Request coalescing / single-flight", "Jittered TTLs", "Increasing the cache size", "Serving stale while revalidating"] },
        correct: { indexes: [0, 1, 3] },
        points: 3,
        explanation: "Cache size doesn't help a thundering herd — the entry is missing, not evicted for space.",
        position: 6,
      },
      {
        type: "SINGLE_CHOICE",
        prompt: { text: "Which rate-limiting algorithm smooths bursts while still allowing a saved-up allowance?" },
        options: { choices: ["Fixed window", "Token bucket", "Hard quota per day", "Random drop"] },
        correct: { index: 1 },
        points: 2,
        explanation: "Token bucket accrues tokens up to a cap, so an idle client can burst, then settles to the refill rate.",
        position: 7,
      },
      {
        type: "SINGLE_CHOICE",
        prompt: { text: "Your service calls a third-party API that starts timing out. What stops the failure cascading into your own request threads?" },
        options: { choices: ["Retrying more aggressively", "A circuit breaker with a timeout", "A larger thread pool", "Logging the error"] },
        correct: { index: 1 },
        points: 2,
        explanation: "A breaker fails fast once the dependency is unhealthy, freeing threads instead of parking them on a dead call. Aggressive retries make it worse.",
        position: 8,
      },
    ],
  },
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
    // ── Second wave: deeper leaderboard + more grading-queue bodies ────
    { email: "meghna@learner.test", name: "Meghna Sarkar", xp: 3960, cur: 19, long: 26, badges: ["first-lesson", "first-course", "streak-7", "streak-30", "first-project"] },
    { email: "abhishek@learner.test", name: "Abhishek Rathore", xp: 3210, cur: 11, long: 24, badges: ["first-lesson", "first-course", "streak-7", "community-helper"] },
    { email: "lavanya@learner.test", name: "Lavanya Krishnan", xp: 2890, cur: 16, long: 20, badges: ["first-lesson", "first-course", "streak-7"] },
    { email: "imran@learner.test", name: "Imran Sayyed", xp: 2360, cur: 0, long: 17, badges: ["first-lesson", "first-course"] },
    { email: "ritika@learner.test", name: "Ritika Agarwal", xp: 2050, cur: 9, long: 15, badges: ["first-lesson", "first-course", "streak-7"] },
    { email: "joel@learner.test", name: "Joel Fernandes", xp: 1770, cur: 5, long: 12, badges: ["first-lesson", "first-course"] },
    { email: "shalini@learner.test", name: "Shalini Prasad", xp: 1540, cur: 7, long: 11, badges: ["first-lesson", "streak-7"] },
    { email: "devansh@learner.test", name: "Devansh Trivedi", xp: 1290, cur: 0, long: 9, badges: ["first-lesson", "first-course"] },
    { email: "kavya@learner.test", name: "Kavya Subramanian", xp: 1060, cur: 4, long: 8, badges: ["first-lesson"] },
    { email: "yusuf@learner.test", name: "Yusuf Ansari", xp: 870, cur: 2, long: 6, badges: ["first-lesson"] },
    { email: "pallavi@learner.test", name: "Pallavi Deshpande", xp: 700, cur: 6, long: 6, badges: ["first-lesson", "streak-7"] },
    { email: "gagan@learner.test", name: "Gagandeep Singh", xp: 560, cur: 0, long: 4, badges: ["first-lesson"] },
    { email: "anushka@learner.test", name: "Anushka Bose", xp: 340, cur: 3, long: 3, badges: ["first-lesson"] },
    { email: "hemant@learner.test", name: "Hemant Chaudhary", xp: 210, cur: 1, long: 2, badges: [] },
    // Lapsed: signed up, watched a lesson, never came back.
    { email: "swati@learner.test", name: "Swati Bhardwaj", xp: 60, cur: 0, long: 1, badges: [] },
    { email: "raghav@learner.test", name: "Raghav Nambiar", xp: 40, cur: 0, long: 1, badges: [] },
  ];

  /** Learners we deliberately leave cold — "lapsed" cards on the dashboard. */
  const LAPSED = new Set(["swati@learner.test", "raghav@learner.test", "devansh@learner.test", "imran@learner.test"]);

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
  // Demo Academy's owner. Created here via ensureUser (the standalone
  // demo-account script that used to create it was removed in a245761), so the
  // seed runs end to end on a completely clean database.
  const cora = await ensureUser("creator@demo.test", "Cora D'Souza");
  const nikhil = await ensureUser("nikhil@cloudforge.test", "Nikhil Deshpande");
  const meera = await ensureUser("meera@sentinel.test", "Meera Raghavan");
  const ritu = await ensureUser("ritu@pixelforge.test", "Ritu Bansal");

  const mentorRithvik = await ensureUser("rithvik@mentor.test", "Rithvik Menon");
  const mentorLakshmi = await ensureUser("lakshmi@mentor.test", "Lakshmi Narayan");
  const mentorAditya = await ensureUser("aditya@mentor.test", "Aditya Kulkarni");
  const mentorPriyanka = await ensureUser("priyanka@mentor.test", "Priyanka Sinha");
  const mentorHarish = await ensureUser("harish@mentor.test", "Harish Venkat");
  const mentorFatima = await ensureUser("fatima@mentor.test", "Fatima Qureshi");
  const mentorSuresh = await ensureUser("suresh@mentor.test", "Suresh Balakrishnan");
  const mentorAnkita = await ensureUser("ankita@mentor.test", "Ankita Deshmukh");
  const mentorJoseph = await ensureUser("joseph@mentor.test", "Joseph Mathew");

  // ─────────────────────────────────────────────────────────────────────
  // Creator tenants
  // ─────────────────────────────────────────────────────────────────────
  const demoTenant = await db.tenant.findUniqueOrThrow({ where: { slug: "demo-academy" } });
  await ensureMember(demoTenant.organizationId, cora.id, "owner");
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
  const cloudforge = await ensureCreatorTenant(
    "org_cloudforge",
    "cloudforge",
    "CloudForge Labs",
    "Cloud, platform and reliability engineering from people who carry the pager.",
    nikhil.id,
  );
  const sentinel = await ensureCreatorTenant(
    "org_sentinel",
    "sentinel-labs",
    "Sentinel Labs",
    "Security and quality engineering, taught hands-on in safe lab environments.",
    meera.id,
  );
  const pixelforge = await ensureCreatorTenant(
    "org_pixelforge",
    "pixelforge",
    "Pixelforge Studio",
    "Mobile, product and design craft for engineers who ship to real users.",
    ritu.id,
  );

  const tenantBySlug: Record<string, { id: string; slug: string; creatorId: string }> = {
    "demo-academy": { id: demoTenant.id, slug: "demo-academy", creatorId: cora.id },
    codecraft: { id: codecraft.id, slug: "codecraft", creatorId: gaurav.id },
    datawicket: { id: datawicket.id, slug: "datawicket", creatorId: shreya.id },
    cloudforge: { id: cloudforge.id, slug: "cloudforge", creatorId: nikhil.id },
    "sentinel-labs": { id: sentinel.id, slug: "sentinel-labs", creatorId: meera.id },
    pixelforge: { id: pixelforge.id, slug: "pixelforge", creatorId: ritu.id },
  };

  // ─────────────────────────────────────────────────────────────────────
  // Mentor profiles
  // ─────────────────────────────────────────────────────────────────────
  const ensureMentor = async (
    userId: string,
    headline: string,
    level: "ASSOCIATE" | "SENIOR" | "PRINCIPAL",
    expertiseTags: string[],
    opts: { capacity?: number; payoutBps?: number; languages?: string[] } = {},
  ) =>
    db.mentorProfile.upsert({
      where: { userId },
      update: { status: "ACTIVE", level, expertiseTags, maxActiveInstances: opts.capacity ?? 8 },
      create: {
        userId,
        headline,
        bio: doc(headline),
        expertiseTags,
        level,
        status: "ACTIVE",
        vettedAt: daysAgo(200),
        maxActiveInstances: opts.capacity ?? 8,
        defaultPayoutBps: opts.payoutBps ?? 5500,
        languages: opts.languages ?? ["en", "hi"],
        availability: { weeklyHours: (opts.capacity ?? 8) * 1.5, slots: ["tue-eve", "thu-eve", "sat-morning"] },
      },
    });

  const mpRithvik = await ensureMentor(mentorRithvik.id, "Staff Engineer • Distributed Systems", "SENIOR", ["distributed-systems", "backend", "go"], { capacity: 8 });
  const mpLakshmi = await ensureMentor(mentorLakshmi.id, "Principal Engineer • Realtime & Infra", "PRINCIPAL", ["realtime", "infra", "typescript"], { capacity: 5, payoutBps: 6000 });
  const mpAditya = await ensureMentor(mentorAditya.id, "Senior Engineer • Full-Stack", "ASSOCIATE", ["react", "node", "postgres"], { capacity: 10, payoutBps: 5000 });
  const mpPriyanka = await ensureMentor(mentorPriyanka.id, "Principal Data Scientist • Recsys & Ranking", "PRINCIPAL", ["machine-learning", "pytorch", "recsys", "python"], { capacity: 4, payoutBps: 6000, languages: ["en", "hi", "bn"] });
  const mpHarish = await ensureMentor(mentorHarish.id, "Staff SRE • Kubernetes & Observability", "SENIOR", ["kubernetes", "sre", "terraform", "observability"], { capacity: 7 });
  const mpFatima = await ensureMentor(mentorFatima.id, "Security Engineer • AppSec & Cloud", "SENIOR", ["appsec", "cloud-security", "threat-modelling"], { capacity: 6 });
  const mpSuresh = await ensureMentor(mentorSuresh.id, "Principal Architect • Payments & Ledgers", "PRINCIPAL", ["payments", "system-design", "java", "kafka"], { capacity: 4, payoutBps: 6200, languages: ["en", "ta"] });
  const mpAnkita = await ensureMentor(mentorAnkita.id, "Senior Mobile Engineer • Android & Flutter", "ASSOCIATE", ["android", "kotlin", "flutter", "mobile"], { capacity: 10, payoutBps: 5000, languages: ["en", "hi", "mr"] });
  const mpJoseph = await ensureMentor(mentorJoseph.id, "Senior QA Architect • Automation & Performance", "ASSOCIATE", ["playwright", "test-automation", "k6"], { capacity: 9, payoutBps: 5000, languages: ["en", "ml"] });

  // ─────────────────────────────────────────────────────────────────────
  // Categories lookup
  // ─────────────────────────────────────────────────────────────────────
  const cats = await db.category.findMany({ select: { id: true, slug: true } });
  const catBySlug: Record<string, string> = Object.fromEntries(cats.map((c) => [c.slug, c.id]));

  // ─────────────────────────────────────────────────────────────────────
  // Courses (+ sections, lessons, quiz, assignment, price, rating)
  // ─────────────────────────────────────────────────────────────────────
  const catalog: Record<string, CatalogEntry> = {};

  /**
   * Four-section spine covering every LessonType the player renders
   * (VIDEO / ARTICLE / QUIZ / ASSIGNMENT / RESOURCE / EMBED). CODE_LAB is
   * opt-in (`opts.lab`) because it renders a vendor placeholder until Fermion
   * is wired up, so only a few courses carry one.
   */
  const ensureCourseContent = async (
    courseId: string,
    slug: string,
    title: string,
    opts: { lab?: boolean; variant?: number } = {},
  ) => {
    if ((await db.courseSection.count({ where: { courseId } })) > 0) return;
    const variant = opts.variant ?? 0;
    const s1 = await db.courseSection.create({ data: { courseId, title: "Getting started", position: 0 } });
    const s2 = await db.courseSection.create({ data: { courseId, title: "Core concepts", position: 1 } });
    const s3 = await db.courseSection.create({ data: { courseId, title: "Applied practice", position: 2 } });
    const s4 = await db.courseSection.create({ data: { courseId, title: "Build & assess", position: 3 } });

    const lessons: Prisma.LessonCreateManyInput[] = [
      { sectionId: s1.id, courseId, type: "ARTICLE", title: "How this course works", position: 0, isFreePreview: true, content: doc(`What you'll build in ${title}, how the modules fit together, and how much time to budget each week.`) },
      { sectionId: s1.id, courseId, type: "VIDEO", title: "Setting up your environment", position: 1, isFreePreview: true, durationSec: 660 + variant * 90 },
      { sectionId: s1.id, courseId, type: "RESOURCE", title: "Starter repo & setup checklist", position: 2, content: doc("Clone the starter repository and run the setup checklist before the next lesson.") },
      { sectionId: s2.id, courseId, type: "VIDEO", title: "The mental model", position: 0, durationSec: 1080 + variant * 60 },
      { sectionId: s2.id, courseId, type: "VIDEO", title: "Working through the happy path", position: 1, durationSec: 940 + variant * 45 },
      { sectionId: s2.id, courseId, type: "ARTICLE", title: "What breaks in production (and why)", position: 2, content: doc("The failure modes practitioners actually hit, with the reasoning behind each mitigation.") },
      { sectionId: s2.id, courseId, type: "EMBED", title: "Interactive walkthrough", position: 3, content: { provider: "EXTERNAL_EMBED", url: `https://embed.example.test/${slug}/walkthrough`, aspectRatio: "16:9", allowFullscreen: true } },
      { sectionId: s3.id, courseId, type: "VIDEO", title: "Building the reference implementation", position: 0, durationSec: 1500 + variant * 120 },
      opts.lab
        ? { sectionId: s3.id, courseId, type: "CODE_LAB", title: "Hands-on lab: build it yourself", position: 1, labConfig: { provider: "FERMION", labRef: `${slug}-lab-1` } }
        : { sectionId: s3.id, courseId, type: "ARTICLE", title: "Guided exercise: build it yourself", position: 1, content: doc("Work through the exercise in your own repo, then compare against the reference solution.") },
      { sectionId: s3.id, courseId, type: "RESOURCE", title: "Cheat sheet, templates & further reading", position: 2, content: doc("Downloadable references, checklists and links used throughout the course.") },
      { sectionId: s4.id, courseId, type: "QUIZ", title: "Knowledge check", position: 0 },
      { sectionId: s4.id, courseId, type: "ASSIGNMENT", title: `${title}: final assignment`, position: 1 },
      { sectionId: s4.id, courseId, type: "ARTICLE", title: "Where to go next", position: 2, content: doc("Suggested follow-on projects, reading and the mentor-guided project that pairs with this course.") },
    ];
    if (variant % 2 === 1) {
      lessons.splice(6, 0, { sectionId: s2.id, courseId, type: "VIDEO", title: "Tradeoffs and alternatives", position: 3, durationSec: 820 });
      // keep positions unique inside the section
      lessons[7] = { ...lessons[7], position: 4 };
    }
    await db.lesson.createMany({ data: lessons });

    const quizLesson = await db.lesson.findFirstOrThrow({ where: { courseId, type: "QUIZ" } });
    const rich = RICH_QUIZZES[slug];
    await db.quiz.create({
      data: rich
        ? {
            lessonId: quizLesson.id,
            title: rich.title,
            instructions: rich.instructions,
            passPct: rich.passPct,
            maxAttempts: null,
            timeLimitSec: rich.timeLimitSec,
            questions: { create: rich.questions as never },
          }
        : {
        lessonId: quizLesson.id,
        title: "Knowledge check",
        // Low-stakes by policy: retrieval practice is what makes quizzes work,
        // so unlimited retries and a modest bar. The credential rests on
        // mentor-reviewed project work, not on clearing a quiz.
        // Copy states the real gates — a mismatch here is a lie to the learner.
        instructions:
          "Three questions, about five minutes. 60% to pass, and you can retry as often as you like.",
        passPct: 60,
        maxAttempts: null,
        timeLimitSec: 600,
        questions: {
          create: [
            { type: "SINGLE_CHOICE", prompt: { text: "Which practice does this module recommend first?" }, options: { choices: ["Optimize early", "Measure, then optimize", "Skip tests", "Avoid abstractions"] }, correct: { index: 1 }, points: 2, explanation: "Measure before optimizing.", position: 0 },
            { type: "TRUE_FALSE", prompt: { text: "Idempotent operations can be retried safely." }, options: { choices: ["True", "False"] }, correct: { index: 0 }, points: 1, explanation: "That is the definition of idempotency.", position: 1 },
            { type: "MULTI_CHOICE", prompt: { text: "Which of these belong in a production readiness review?" }, options: { choices: ["Runbook", "Rollback plan", "Personal preference", "Alert thresholds"] }, correct: { indexes: [0, 1, 3] }, points: 3, explanation: "Everything except personal preference is reviewable evidence.", position: 2 },
          ],
        },
      },
    });

    const asLesson = await db.lesson.findFirstOrThrow({ where: { courseId, type: "ASSIGNMENT" } });
    await db.assignment.create({
      data: {
        lessonId: asLesson.id,
        title: `${title}: final assignment`,
        instructions: doc("Apply the course material to a small end-to-end build. Submit a public repo link plus a short write-up covering the decisions you made and what you'd do differently with more time."),
        gradingType: "MANUAL",
        maxPoints: 100,
        dueOffsetDays: 21,
        allowLate: true,
        allowResubmission: true,
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
    /** Denormalized social proof — also the catalog's primary sort key. */
    enrollments?: number;
    prereqs?: string[];
    /** CODE_LAB lessons render a vendor placeholder — opt in sparingly. */
    lab?: boolean;
    variant?: number;
    publishedDaysAgo?: number;
  };

  // A marketplace-shaped catalog: 4–6 published courses in every category the
  // browse page renders as a row, so no category shows a lone card.
  const COURSES: CourseSpec[] = [
    // ── Web Development ────────────────────────────────────────────────
    { tenantSlug: "codecraft", slug: "advanced-react-patterns", title: "Advanced React Patterns", subtitle: "Composition, state machines and rendering you can reason about", categorySlug: "web-development", level: "ADVANCED", tags: ["react", "hooks", "performance"], outcomes: ["Compose without prop drilling", "Model UI state as machines", "Diagnose re-render storms"], prereqs: ["Comfortable with React and hooks"], hours: 17, price: 3999, compareAt: 5999, ratingAvg: 4.7, ratingCount: 186, enrollments: 1940, variant: 1 },
    { tenantSlug: "demo-academy", slug: "node-microservices", title: "Node.js Microservices at Scale", subtitle: "Service boundaries, queues and the failure modes nobody warns you about", categorySlug: "web-development", level: "ADVANCED", tags: ["node", "microservices", "rabbitmq", "grpc"], outcomes: ["Draw honest service boundaries", "Make async work idempotent", "Trace a request across services"], prereqs: ["Solid JavaScript", "Some backend experience"], hours: 32, price: 6499, compareAt: 8999, ratingAvg: 4.5, ratingCount: 121, enrollments: 1120, liveEnabled: true, variant: 1 },
    { tenantSlug: "codecraft", slug: "tailwind-design-systems", title: "Design Systems with Tailwind CSS", subtitle: "Tokens, variants and a component library your team will actually use", categorySlug: "web-development", level: "BEGINNER", tags: ["tailwind", "css", "design-system"], outcomes: ["Define a token layer", "Build accessible variants", "Ship a documented library"], prereqs: ["HTML & CSS basics"], hours: 12, price: 1999, compareAt: 3499, ratingAvg: 4.6, ratingCount: 208, enrollments: 2380 },
    { tenantSlug: "demo-academy", slug: "django-rest-production", title: "Django REST APIs in Production", subtitle: "Auth, pagination, throttling and the boring things that keep you online", categorySlug: "web-development", level: "INTERMEDIATE", tags: ["python", "django", "rest", "postgres"], outcomes: ["Design serializer boundaries", "Ship token auth safely", "Tune the ORM's worst queries"], prereqs: ["Python fundamentals"], hours: 24, price: 4499, compareAt: 6499, ratingAvg: 4.4, ratingCount: 94, enrollments: 860 },

    // ── Data Science & AI ──────────────────────────────────────────────
    { tenantSlug: "demo-academy", slug: "python-data-analysis", title: "Python for Data Analysis", subtitle: "Pandas, NumPy and real datasets end-to-end", categorySlug: "data-science-ai", level: "BEGINNER", tags: ["python", "pandas", "numpy"], outcomes: ["Clean messy data", "Aggregate & visualize", "Ship a notebook report"], hours: 18, price: 2999, compareAt: 4999, ratingAvg: 4.7, ratingCount: 214, enrollments: 3120 },
    { tenantSlug: "datawicket", slug: "ml-foundations", title: "Machine Learning Foundations", subtitle: "From linear models to model evaluation", categorySlug: "data-science-ai", level: "INTERMEDIATE", tags: ["ml", "scikit-learn", "python"], outcomes: ["Train baseline models", "Evaluate rigorously", "Avoid leakage"], hours: 28, price: 5999, compareAt: 8499, ratingAvg: 4.7, ratingCount: 189, enrollments: 2210, lab: true },
    { tenantSlug: "datawicket", slug: "sql-mastery", title: "SQL Mastery for Analysts", subtitle: "Window functions, CTEs and query tuning", categorySlug: "data-science-ai", level: "BEGINNER", tags: ["sql", "postgres", "analytics"], outcomes: ["Write complex joins", "Use window functions", "Read query plans"], hours: 14, price: 1999, compareAt: 2999, ratingAvg: 4.8, ratingCount: 243, enrollments: 3480 },
    { tenantSlug: "datawicket", slug: "deep-learning-pytorch", title: "Deep Learning with PyTorch", subtitle: "Build, train and debug networks without the hand-waving", categorySlug: "data-science-ai", level: "ADVANCED", tags: ["pytorch", "deep-learning", "gpu"], outcomes: ["Write training loops you trust", "Debug exploding losses", "Profile GPU utilisation"], prereqs: ["Python", "Linear algebra basics"], hours: 34, price: 7999, compareAt: 10999, ratingAvg: 4.6, ratingCount: 141, enrollments: 1180, variant: 1 },
    { tenantSlug: "datawicket", slug: "llm-engineering", title: "LLM Application Engineering", subtitle: "Retrieval, evals and cost control for production LLM apps", categorySlug: "data-science-ai", level: "INTERMEDIATE", tags: ["llm", "rag", "evals", "python"], outcomes: ["Build a retrieval pipeline", "Write offline evals that catch regressions", "Control token spend"], prereqs: ["Python", "Basic API work"], hours: 21, price: 6499, compareAt: 8999, ratingAvg: 4.5, ratingCount: 167, enrollments: 2040, liveEnabled: true },
    { tenantSlug: "datawicket", slug: "data-engineering-airflow", title: "Data Engineering with Airflow & dbt", subtitle: "Pipelines that are idempotent, testable and on time", categorySlug: "data-science-ai", level: "INTERMEDIATE", tags: ["airflow", "dbt", "warehouse", "sql"], outcomes: ["Model a warehouse layer", "Write idempotent DAGs", "Test data, not just code"], prereqs: ["SQL", "Some Python"], hours: 26, price: 5499, compareAt: 7499, ratingAvg: 4.4, ratingCount: 88, enrollments: 790, variant: 1 },

    // ── DevOps & Cloud ─────────────────────────────────────────────────
    { tenantSlug: "demo-academy", slug: "docker-kubernetes", title: "Docker & Kubernetes in Practice", subtitle: "Containerize and orchestrate real services", categorySlug: "devops-cloud", level: "INTERMEDIATE", tags: ["docker", "kubernetes", "devops"], outcomes: ["Write production Dockerfiles", "Deploy to k8s", "Roll out safely"], hours: 26, price: 5499, compareAt: 7999, ratingAvg: 4.6, ratingCount: 168, enrollments: 2560, liveEnabled: true, lab: true },
    { tenantSlug: "cloudforge", slug: "aws-solutions-architect", title: "AWS for Solutions Architects", subtitle: "Design cloud systems that survive a bad Tuesday", categorySlug: "devops-cloud", level: "INTERMEDIATE", tags: ["aws", "cloud", "architecture"], outcomes: ["Pick the right managed service", "Design for multi-AZ failure", "Model cloud cost before you build"], prereqs: ["Networking basics", "Some Linux"], hours: 30, price: 6999, compareAt: 9999, ratingAvg: 4.6, ratingCount: 203, enrollments: 2470, variant: 1 },
    { tenantSlug: "cloudforge", slug: "terraform-iac", title: "Terraform & Infrastructure as Code", subtitle: "Modules, state and drift — the parts that bite in year two", categorySlug: "devops-cloud", level: "INTERMEDIATE", tags: ["terraform", "iac", "aws"], outcomes: ["Write reusable modules", "Manage state safely across teams", "Plan and review infra changes"], prereqs: ["Cloud fundamentals"], hours: 18, price: 4499, compareAt: 5999, ratingAvg: 4.7, ratingCount: 154, enrollments: 1830 },
    { tenantSlug: "cloudforge", slug: "sre-observability", title: "SRE & Observability in Production", subtitle: "SLOs, error budgets and alerts that mean something", categorySlug: "devops-cloud", level: "ADVANCED", tags: ["sre", "observability", "prometheus", "opentelemetry"], outcomes: ["Define SLOs your team agrees on", "Instrument with OpenTelemetry", "Run a blameless incident review"], prereqs: ["Production experience"], hours: 22, price: 6499, compareAt: null, ratingAvg: 4.8, ratingCount: 96, enrollments: 910, liveEnabled: true },
    { tenantSlug: "codecraft", slug: "ci-cd-github-actions", title: "CI/CD with GitHub Actions", subtitle: "From green checkmark to safe production deploy", categorySlug: "devops-cloud", level: "BEGINNER", tags: ["ci-cd", "github-actions", "automation"], outcomes: ["Build a fast, cached pipeline", "Gate merges on real signals", "Deploy with rollback"], prereqs: ["Git basics"], hours: 11, price: 1999, compareAt: 2999, ratingAvg: 4.5, ratingCount: 231, enrollments: 3010 },

    // ── System Design ──────────────────────────────────────────────────
    { tenantSlug: "demo-academy", slug: "system-design-interview", title: "System Design Interview Prep", subtitle: "Reason about scale, tradeoffs and bottlenecks", categorySlug: "system-design", level: "ADVANCED", tags: ["system-design", "scalability", "interviews"], outcomes: ["Estimate capacity", "Design for scale", "Communicate tradeoffs"], hours: 22, price: 4499, compareAt: null, ratingAvg: 4.8, ratingCount: 301, enrollments: 4120, liveEnabled: true },
    { tenantSlug: "cloudforge", slug: "distributed-systems-fundamentals", title: "Distributed Systems Fundamentals", subtitle: "Consensus, replication and why your clock is lying to you", categorySlug: "system-design", level: "ADVANCED", tags: ["distributed-systems", "consensus", "replication"], outcomes: ["Reason about consistency models", "Explain Raft end to end", "Design around partial failure"], prereqs: ["Strong programming fundamentals"], hours: 29, price: 6999, compareAt: 9499, ratingAvg: 4.9, ratingCount: 118, enrollments: 1290, variant: 1 },
    { tenantSlug: "demo-academy", slug: "event-driven-kafka", title: "Event-Driven Architecture with Kafka", subtitle: "Topics, ordering guarantees and exactly-once, honestly explained", categorySlug: "system-design", level: "INTERMEDIATE", tags: ["kafka", "events", "streaming"], outcomes: ["Design topics and keys", "Handle replays and poison messages", "Reason about delivery guarantees"], prereqs: ["Backend experience"], hours: 20, price: 5499, compareAt: 6999, ratingAvg: 4.5, ratingCount: 87, enrollments: 940 },
    { tenantSlug: "cloudforge", slug: "database-internals", title: "Database Internals & Query Tuning", subtitle: "B-trees, MVCC and reading an execution plan like a pro", categorySlug: "system-design", level: "ADVANCED", tags: ["postgres", "indexing", "performance"], outcomes: ["Choose the right index", "Read and fix a bad plan", "Reason about isolation levels"], prereqs: ["Working SQL knowledge"], hours: 19, price: 5999, compareAt: 7999, ratingAvg: 4.7, ratingCount: 132, enrollments: 1470 },
    { tenantSlug: "demo-academy", slug: "low-level-design-india", title: "Low-Level Design & OOP Interviews", subtitle: "Machine-coding rounds, SOLID, and designing under a 90-minute clock", categorySlug: "system-design", level: "INTERMEDIATE", tags: ["lld", "oop", "interviews", "java"], outcomes: ["Decompose a problem quickly", "Apply SOLID without cargo-culting", "Finish a machine-coding round"], prereqs: ["One OOP language"], hours: 16, price: 3499, compareAt: 4999, ratingAvg: 4.6, ratingCount: 264, enrollments: 3340, variant: 1 },

    // ── Mobile Development ─────────────────────────────────────────────
    { tenantSlug: "codecraft", slug: "react-native-zero", title: "React Native from Zero", subtitle: "Ship a cross-platform app to both stores", categorySlug: "mobile-development", level: "BEGINNER", tags: ["react-native", "mobile", "expo"], outcomes: ["Build native UI", "Handle navigation", "Publish to stores"], hours: 20, price: 3499, compareAt: 5999, ratingAvg: 4.5, ratingCount: 132, enrollments: 1760 },
    { tenantSlug: "pixelforge", slug: "flutter-production", title: "Flutter for Production Apps", subtitle: "State management, platform channels and release engineering", categorySlug: "mobile-development", level: "INTERMEDIATE", tags: ["flutter", "dart", "mobile"], outcomes: ["Pick a state solution and stick to it", "Bridge to native APIs", "Automate store releases"], prereqs: ["Any OOP language"], hours: 23, price: 4499, compareAt: 6499, ratingAvg: 4.6, ratingCount: 149, enrollments: 1620, variant: 1 },
    { tenantSlug: "pixelforge", slug: "android-kotlin-jetpack", title: "Android with Kotlin & Jetpack Compose", subtitle: "Modern Android, from Compose basics to a signed release", categorySlug: "mobile-development", level: "INTERMEDIATE", tags: ["android", "kotlin", "compose"], outcomes: ["Build declarative Android UI", "Structure with ViewModels and flows", "Ship to the Play Store"], prereqs: ["Basic Kotlin or Java"], hours: 27, price: 4999, compareAt: 6999, ratingAvg: 4.7, ratingCount: 176, enrollments: 1980 },
    { tenantSlug: "pixelforge", slug: "ios-swiftui", title: "iOS Development with SwiftUI", subtitle: "Declarative iOS apps, from first view to TestFlight", categorySlug: "mobile-development", level: "BEGINNER", tags: ["ios", "swift", "swiftui"], outcomes: ["Compose SwiftUI views", "Persist data locally", "Ship a TestFlight build"], prereqs: ["Some programming experience"], hours: 22, price: 4299, compareAt: 5999, ratingAvg: 4.4, ratingCount: 103, enrollments: 1140 },
    { tenantSlug: "codecraft", slug: "mobile-app-performance", title: "Mobile Performance & Release Engineering", subtitle: "Startup time, jank, crash budgets and staged rollouts", categorySlug: "mobile-development", level: "ADVANCED", tags: ["performance", "mobile", "release"], outcomes: ["Profile cold start", "Kill jank with real traces", "Run a staged rollout with kill switches"], prereqs: ["A shipped mobile app"], hours: 15, price: 5499, compareAt: null, ratingAvg: 4.8, ratingCount: 71, enrollments: 640 },

    // ── Cybersecurity ──────────────────────────────────────────────────
    { tenantSlug: "codecraft", slug: "ethical-hacking", title: "Ethical Hacking Bootcamp", subtitle: "Offensive security fundamentals, hands-on", categorySlug: "cybersecurity", level: "INTERMEDIATE", tags: ["security", "pentest", "networking"], outcomes: ["Recon & scanning", "Exploit common flaws", "Write a report"], hours: 30, price: 6999, compareAt: 9999, ratingAvg: 4.4, ratingCount: 97, enrollments: 1310, lab: true },
    { tenantSlug: "sentinel-labs", slug: "web-app-security", title: "Web Application Security & OWASP Top 10", subtitle: "Find, exploit and then actually fix the classics", categorySlug: "cybersecurity", level: "INTERMEDIATE", tags: ["appsec", "owasp", "web"], outcomes: ["Exploit each OWASP category in a lab", "Write a developer-readable finding", "Verify the fix"], prereqs: ["Web development basics"], hours: 24, price: 5499, compareAt: 7999, ratingAvg: 4.7, ratingCount: 158, enrollments: 1720, variant: 1 },
    { tenantSlug: "sentinel-labs", slug: "cloud-security-aws", title: "Cloud Security on AWS", subtitle: "IAM, network boundaries and detecting the breach you missed", categorySlug: "cybersecurity", level: "ADVANCED", tags: ["cloud-security", "aws", "iam"], outcomes: ["Design least-privilege IAM", "Segment a VPC properly", "Build detection that fires once"], prereqs: ["AWS fundamentals"], hours: 26, price: 7499, compareAt: 9999, ratingAvg: 4.6, ratingCount: 84, enrollments: 720 },
    { tenantSlug: "sentinel-labs", slug: "soc-analyst-blue-team", title: "SOC Analyst & Blue Team Essentials", subtitle: "Triage, hunt and write the incident report", categorySlug: "cybersecurity", level: "BEGINNER", tags: ["blue-team", "soc", "siem", "incident-response"], outcomes: ["Triage alerts without drowning", "Hunt with log queries", "Write an incident timeline"], prereqs: ["Networking basics"], hours: 20, price: 3999, compareAt: 5499, ratingAvg: 4.3, ratingCount: 112, enrollments: 1450 },
    { tenantSlug: "sentinel-labs", slug: "secure-coding-appsec", title: "Secure Coding for Engineers", subtitle: "Threat modelling and defensive patterns for people who ship features", categorySlug: "cybersecurity", level: "INTERMEDIATE", tags: ["secure-coding", "threat-modelling", "appsec"], outcomes: ["Threat-model a feature in an hour", "Apply defensive patterns by default", "Review a PR for security"], prereqs: ["Two years of coding"], hours: 14, price: 3499, compareAt: 4999, ratingAvg: 4.5, ratingCount: 129, enrollments: 1560 },

    // ── Programming Languages ──────────────────────────────────────────
    { tenantSlug: "codecraft", slug: "typescript-deep-dive", title: "TypeScript Deep Dive", subtitle: "Master the type system the pros use", categorySlug: "programming-languages", level: "INTERMEDIATE", tags: ["typescript", "types", "generics"], outcomes: ["Model with generics", "Narrow types safely", "Author declaration files"], hours: 15, price: 2499, compareAt: 3999, ratingAvg: 4.9, ratingCount: 276, enrollments: 3720 },
    { tenantSlug: "codecraft", slug: "golang-for-backend", title: "Go for Backend Engineers", subtitle: "Goroutines, channels and services that stay boring", categorySlug: "programming-languages", level: "INTERMEDIATE", tags: ["go", "concurrency", "backend"], outcomes: ["Use goroutines without leaks", "Design idiomatic packages", "Profile and tune a service"], prereqs: ["Any backend language"], hours: 19, price: 3999, compareAt: 5499, ratingAvg: 4.7, ratingCount: 143, enrollments: 1610, variant: 1 },
    { tenantSlug: "codecraft", slug: "rust-systems-programming", title: "Rust for Systems Programming", subtitle: "Ownership, lifetimes and fearless concurrency, for real", categorySlug: "programming-languages", level: "ADVANCED", tags: ["rust", "systems", "concurrency"], outcomes: ["Work with the borrow checker", "Write safe concurrent code", "Interop with C"], prereqs: ["Systems programming exposure"], hours: 25, price: 5999, compareAt: 7999, ratingAvg: 4.8, ratingCount: 92, enrollments: 830, lab: true },
    { tenantSlug: "demo-academy", slug: "python-mastery", title: "Modern Python Mastery", subtitle: "Typing, async, packaging and the standard library you forgot about", categorySlug: "programming-languages", level: "BEGINNER", tags: ["python", "async", "typing"], outcomes: ["Write typed, testable Python", "Use asyncio without deadlocks", "Package and publish a library"], hours: 16, price: 2499, compareAt: 3999, ratingAvg: 4.6, ratingCount: 197, enrollments: 2650 },

    // ── QA & Test Automation ───────────────────────────────────────────
    { tenantSlug: "sentinel-labs", slug: "playwright-e2e", title: "End-to-End Testing with Playwright", subtitle: "Fast, non-flaky browser tests you can run on every PR", categorySlug: "qa-testing", level: "INTERMEDIATE", tags: ["playwright", "e2e", "testing"], outcomes: ["Write deterministic selectors", "Parallelise a suite safely", "Debug a flake to root cause"], prereqs: ["JavaScript basics"], hours: 13, price: 2999, compareAt: 4499, ratingAvg: 4.7, ratingCount: 121, enrollments: 1420 },
    { tenantSlug: "codecraft", slug: "unit-testing-tdd", title: "Unit Testing & TDD for JavaScript", subtitle: "Tests that let you refactor instead of tests that block you", categorySlug: "qa-testing", level: "BEGINNER", tags: ["testing", "tdd", "vitest"], outcomes: ["Write behaviour-first tests", "Refactor safely under coverage", "Know what not to test"], hours: 10, price: 1499, compareAt: 2499, ratingAvg: 4.5, ratingCount: 188, enrollments: 2280 },
    { tenantSlug: "sentinel-labs", slug: "api-test-automation", title: "API Test Automation", subtitle: "Contract, integration and regression testing for HTTP services", categorySlug: "qa-testing", level: "BEGINNER", tags: ["api-testing", "postman", "contract-testing"], outcomes: ["Automate an API regression pack", "Test contracts, not implementations", "Wire tests into CI"], prereqs: ["HTTP basics"], hours: 12, price: 1999, compareAt: 2999, ratingAvg: 4.3, ratingCount: 96, enrollments: 1180 },
    { tenantSlug: "cloudforge", slug: "performance-testing-k6", title: "Performance Testing with k6", subtitle: "Load models, percentiles and finding the knee before your users do", categorySlug: "qa-testing", level: "INTERMEDIATE", tags: ["k6", "load-testing", "performance"], outcomes: ["Build a realistic load model", "Read p99 without fooling yourself", "Gate releases on performance"], prereqs: ["JavaScript basics"], hours: 11, price: 2999, compareAt: null, ratingAvg: 4.6, ratingCount: 63, enrollments: 610, variant: 1 },

    // ── Blockchain & Web3 ──────────────────────────────────────────────
    { tenantSlug: "codecraft", slug: "solidity-smart-contracts", title: "Solidity & Smart Contract Development", subtitle: "From first contract to a tested, gas-aware deployment", categorySlug: "blockchain", level: "INTERMEDIATE", tags: ["solidity", "ethereum", "foundry"], outcomes: ["Write and test contracts with Foundry", "Reason about gas", "Deploy to a testnet safely"], prereqs: ["Any programming language"], hours: 21, price: 4999, compareAt: 6999, ratingAvg: 4.4, ratingCount: 87, enrollments: 940 },
    { tenantSlug: "codecraft", slug: "web3-dapp-engineering", title: "Web3 dApp Engineering", subtitle: "Wallets, indexing and a frontend that survives a chain reorg", categorySlug: "blockchain", level: "INTERMEDIATE", tags: ["web3", "dapp", "react", "ethers"], outcomes: ["Wire wallet connection properly", "Index on-chain data", "Handle pending and reverted states"], prereqs: ["React basics"], hours: 18, price: 4499, compareAt: 5999, ratingAvg: 4.2, ratingCount: 58, enrollments: 620, variant: 1 },
    { tenantSlug: "sentinel-labs", slug: "smart-contract-security", title: "Smart Contract Security & Auditing", subtitle: "Reentrancy, oracle games and how audits actually get written", categorySlug: "blockchain", level: "ADVANCED", tags: ["security", "audit", "solidity"], outcomes: ["Find the classic vulnerability classes", "Use fuzzing and invariant tests", "Write an audit report"], prereqs: ["Solidity experience"], hours: 20, price: 8499, compareAt: 11999, ratingAvg: 4.7, ratingCount: 44, enrollments: 380 },

    // ── Product & Design ───────────────────────────────────────────────
    { tenantSlug: "pixelforge", slug: "product-management-tech", title: "Product Management for Engineers", subtitle: "Discovery, prioritisation and saying no with evidence", categorySlug: "product-design", level: "BEGINNER", tags: ["product", "discovery", "prioritisation"], outcomes: ["Run a discovery interview", "Prioritise with a defensible model", "Write a spec people read"], hours: 12, price: 2499, compareAt: 3999, ratingAvg: 4.4, ratingCount: 134, enrollments: 1690 },
    { tenantSlug: "pixelforge", slug: "ux-design-foundations", title: "UX Design Foundations", subtitle: "Research, information architecture and interfaces that explain themselves", categorySlug: "product-design", level: "BEGINNER", tags: ["ux", "research", "ia"], outcomes: ["Run lightweight user research", "Structure information clearly", "Test a prototype with five users"], hours: 15, price: 2999, compareAt: 4499, ratingAvg: 4.5, ratingCount: 112, enrollments: 1380, variant: 1 },
    { tenantSlug: "pixelforge", slug: "figma-to-code", title: "Figma to Code: Design Handoff", subtitle: "Tokens, specs and a handoff that doesn't lose the design", categorySlug: "product-design", level: "INTERMEDIATE", tags: ["figma", "design-tokens", "frontend"], outcomes: ["Build a token pipeline", "Spec states and edge cases", "Review implementations against design"], prereqs: ["Some frontend or design experience"], hours: 10, price: 2299, compareAt: 3499, ratingAvg: 4.6, ratingCount: 79, enrollments: 880 },
  ];

  for (const [i, c] of COURSES.entries()) {
    const t = tenantBySlug[c.tenantSlug];
    const enrollmentCount = c.enrollments ?? 500;
    const course = await db.course.upsert({
      where: { tenantId_slug: { tenantId: t.id, slug: c.slug } },
      update: { ratingAvg: c.ratingAvg, ratingCount: c.ratingCount, status: "PUBLISHED", enrollmentCount },
      create: {
        tenantId: t.id,
        createdById: t.creatorId,
        title: c.title,
        slug: c.slug,
        subtitle: c.subtitle,
        description: doc(`${c.title}: ${c.subtitle}.`),
        outcomes: c.outcomes,
        prerequisites: c.prereqs ?? ["Basic programming"],
        level: c.level,
        categoryId: catBySlug[c.categorySlug],
        tags: c.tags,
        status: "PUBLISHED",
        liveEnabled: c.liveEnabled ?? false,
        estimatedHours: c.hours,
        publishedAt: daysAgo(c.publishedDaysAgo ?? 40 + ((i * 7) % 120)),
        ratingAvg: c.ratingAvg,
        ratingCount: c.ratingCount,
        enrollmentCount,
      },
    });
    await ensureCourseContent(course.id, c.slug, c.title, { lab: c.lab, variant: c.variant ?? i % 2 });
    await ensureCoursePrice(course.id, c.price, c.compareAt);
    catalog[c.slug] = { kind: "COURSE", id: course.id, tenantId: t.id, tenantSlug: c.tenantSlug, title: c.title, unitMinor: paise(c.price) };
  }

  // Two work-in-progress courses so the studio has a non-published state to show.
  const DRAFTS: Array<{ tenantSlug: string; slug: string; title: string; subtitle: string; categorySlug: string; status: "DRAFT" | "IN_REVIEW" }> = [
    { tenantSlug: "codecraft", slug: "webassembly-in-anger", title: "WebAssembly in Anger", subtitle: "Compiling real workloads to the browser", categorySlug: "web-development", status: "DRAFT" },
    { tenantSlug: "datawicket", slug: "causal-inference-for-product", title: "Causal Inference for Product Teams", subtitle: "Experiments, uplift and what A/B tests can't tell you", categorySlug: "data-science-ai", status: "IN_REVIEW" },
  ];
  for (const d of DRAFTS) {
    const t = tenantBySlug[d.tenantSlug];
    await db.course.upsert({
      where: { tenantId_slug: { tenantId: t.id, slug: d.slug } },
      update: { status: d.status },
      create: {
        tenantId: t.id,
        createdById: t.creatorId,
        title: d.title,
        slug: d.slug,
        subtitle: d.subtitle,
        description: doc(`${d.title}: ${d.subtitle}.`),
        level: "INTERMEDIATE",
        categoryId: catBySlug[d.categorySlug],
        status: d.status,
        estimatedHours: 14,
      },
    });
  }

  // Add existing base-seed courses to the catalog + backfill ratings/category
  for (const [slug, meta] of [
    ["fullstack-nextjs", { avg: 4.8, count: 356, price: 4999, enrollments: 4680, category: "web-development" }],
    ["api-design-essentials", { avg: 4.6, count: 128, price: 1999, enrollments: 2140, category: "web-development" }],
  ] as const) {
    const course = await db.course.findFirst({ where: { slug, tenantId: demoTenant.id } });
    if (course) {
      await db.course.update({
        where: { id: course.id },
        data: {
          ratingAvg: meta.avg,
          ratingCount: meta.count,
          enrollmentCount: meta.enrollments,
          categoryId: course.categoryId ?? catBySlug[meta.category],
        },
      });
      catalog[slug] = { kind: "COURSE", id: course.id, tenantId: demoTenant.id, tenantSlug: "demo-academy", title: course.title, unitMinor: paise(meta.price) };
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Projects (rubric + criteria + milestones + prices)
  // ─────────────────────────────────────────────────────────────────────
  const ensureRubric = async (
    tenantId: string,
    name: string,
    criteria: Array<{ name: string; description: string; weightPct: number }>,
    version = 1,
  ) => {
    let rubric = await db.rubric.findFirst({ where: { tenantId, name, version } });
    if (!rubric) {
      rubric = await db.rubric.create({
        data: {
          tenantId,
          name,
          version,
          description: `${name} (v${version}) — weighted criteria sum to 100.`,
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
    rubricVersion?: number;
    criteria: Array<{ name: string; description: string; weightPct: number }>;
    milestones: Array<{ title: string; text: string; week: number; weightPct: number }>;
    purchases?: number;
    partnerCompanyName?: string;
    difficulty?: string;
  };

  // Reusable criteria sets — a rubric row per (tenant, name, version), so
  // projects from the same studio share a rubric the way a real team would.
  const SPRINT_CRITERIA = [
    { name: "Correctness", description: "Passes the held-out evaluation cases", weightPct: 50 },
    { name: "Code quality", description: "Structure, tests, readability", weightPct: 30 },
    { name: "Communication", description: "Clear write-up and stated tradeoffs", weightPct: 20 },
  ];
  const SYSTEMS_CRITERIA = [
    { name: "Correctness", description: "Meets the held-out evaluation under load", weightPct: 40 },
    { name: "Scalability", description: "Behaviour under concurrency and partial failure", weightPct: 30 },
    { name: "Code quality", description: "Structure, tests, readability", weightPct: 30 },
  ];
  const FLAGSHIP_CRITERIA = [
    { name: "Systems design", description: "Architecture holds up to adversarial questioning", weightPct: 30 },
    { name: "Correctness", description: "Held-out evaluation and correctness under failure injection", weightPct: 25 },
    { name: "Operational readiness", description: "Observability, runbooks, rollout and rollback", weightPct: 25 },
    { name: "Defense", description: "Live defense: reasoning, tradeoffs and depth of understanding", weightPct: 20 },
  ];

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

    // ── Sprints (2–4 weeks, one mentor checkpoint) ─────────────────────
    {
      tenantSlug: "codecraft", slug: "url-shortener-sprint", title: "Scalable URL Shortener", tier: "SPRINT",
      summary: "Ship a URL shortener that survives a front-page traffic spike: key generation, caching, and analytics.",
      categorySlug: "web-development", techStack: ["typescript", "redis", "postgres"], weeksMin: 2, weeksMax: 3, mentorHours: 2,
      price: 5999, seniorPrice: 7999, principalPrice: 9999, ratingAvg: 4.5, ratingCount: 61, purchases: 140, difficulty: "Comfortable",
      rubricName: "Sprint rubric", criteria: SPRINT_CRITERIA,
      milestones: [
        { title: "Key design & storage", text: "Choose your key scheme and justify collision handling", week: 1, weightPct: 35 },
        { title: "Cache & redirect path", text: "Sub-10ms redirects with a cache that can be cold", week: 2, weightPct: 40 },
        { title: "Analytics & hardening", text: "Click analytics, abuse limits, load test results", week: 3, weightPct: 25 },
      ],
    },
    {
      tenantSlug: "codecraft", slug: "realtime-chat-sprint", title: "Realtime Chat Backend", tier: "SPRINT",
      summary: "Build the backend for a group chat: presence, delivery receipts, and history that paginates correctly.",
      categorySlug: "web-development", techStack: ["typescript", "websockets", "redis"], weeksMin: 2, weeksMax: 4, mentorHours: 2,
      price: 6999, seniorPrice: 8999, principalPrice: 11499, ratingAvg: 4.4, ratingCount: 38, purchases: 96, difficulty: "Comfortable",
      rubricName: "Sprint rubric", criteria: SPRINT_CRITERIA,
      milestones: [
        { title: "Transport & protocol", text: "Message envelope, ack semantics, reconnection", week: 1, weightPct: 35 },
        { title: "Presence & fan-out", text: "Presence across multiple nodes without a thundering herd", week: 2, weightPct: 40 },
        { title: "History & tests", text: "Cursor pagination, ordering guarantees, integration tests", week: 3, weightPct: 25 },
      ],
    },
    {
      tenantSlug: "cloudforge", slug: "deploy-pipeline-sprint", title: "Zero-Downtime Deploy Pipeline", tier: "SPRINT",
      summary: "Take a service from manual deploys to a gated pipeline with canaries, health checks and a one-command rollback.",
      categorySlug: "devops-cloud", techStack: ["github-actions", "docker", "kubernetes"], weeksMin: 2, weeksMax: 3, mentorHours: 2,
      price: 6499, seniorPrice: 8499, principalPrice: 10999, ratingAvg: 4.7, ratingCount: 52, purchases: 118, difficulty: "Comfortable",
      rubricName: "Platform rubric", criteria: SPRINT_CRITERIA,
      milestones: [
        { title: "Pipeline skeleton", text: "Build, test and image publish with caching that actually helps", week: 1, weightPct: 30 },
        { title: "Progressive delivery", text: "Canary rollout driven by health signals", week: 2, weightPct: 45 },
        { title: "Rollback & runbook", text: "One-command rollback plus the runbook that explains it", week: 3, weightPct: 25 },
      ],
    },
    {
      tenantSlug: "cloudforge", slug: "observability-sprint", title: "Observability for a Microservice Fleet", tier: "SPRINT",
      summary: "Instrument three services end to end: traces, RED metrics, structured logs, and alerts that fire once.",
      categorySlug: "devops-cloud", techStack: ["opentelemetry", "prometheus", "grafana"], weeksMin: 2, weeksMax: 4, mentorHours: 2,
      price: 7499, seniorPrice: 9499, principalPrice: 11999, ratingAvg: 4.6, ratingCount: 34, purchases: 82, difficulty: "Comfortable",
      rubricName: "Platform rubric", criteria: SPRINT_CRITERIA,
      milestones: [
        { title: "Trace propagation", text: "One trace id across all three services and the queue", week: 1, weightPct: 35 },
        { title: "Metrics & dashboards", text: "RED metrics and a dashboard that answers 'is it broken?'", week: 2, weightPct: 35 },
        { title: "Alerting & SLOs", text: "SLOs, burn-rate alerts, and proof they don't flap", week: 3, weightPct: 30 },
      ],
    },
    {
      tenantSlug: "datawicket", slug: "llm-rag-sprint", title: "RAG Assistant over Private Docs", tier: "SPRINT",
      summary: "Build a retrieval-augmented assistant with an offline eval set — and prove the retrieval actually helps.",
      categorySlug: "data-science-ai", techStack: ["python", "fastapi", "embeddings"], weeksMin: 2, weeksMax: 4, mentorHours: 2,
      price: 8999, seniorPrice: 11499, principalPrice: 13999, ratingAvg: 4.5, ratingCount: 47, purchases: 165, difficulty: "Comfortable",
      rubricName: "ML rubric", criteria: SPRINT_CRITERIA,
      milestones: [
        { title: "Ingestion & chunking", text: "Chunking strategy with a defensible evaluation", week: 1, weightPct: 30 },
        { title: "Retrieval & generation", text: "Hybrid retrieval, grounded answers, citations", week: 2, weightPct: 40 },
        { title: "Evals & cost", text: "Offline eval harness plus a token-cost budget", week: 3, weightPct: 30 },
      ],
    },
    {
      tenantSlug: "pixelforge", slug: "mobile-payments-sprint", title: "UPI Payments Flow in React Native", tier: "SPRINT",
      summary: "Implement a production UPI checkout: deep links, pending states, reconciliation and the retry nobody tests.",
      categorySlug: "mobile-development", techStack: ["react-native", "razorpay", "typescript"], weeksMin: 2, weeksMax: 3, mentorHours: 2,
      price: 6499, seniorPrice: 8499, principalPrice: 10499, ratingAvg: 4.3, ratingCount: 29, purchases: 74, difficulty: "Comfortable",
      rubricName: "Mobile rubric", criteria: SPRINT_CRITERIA,
      milestones: [
        { title: "Checkout & deep links", text: "Handle the app-switch round trip on both platforms", week: 1, weightPct: 35 },
        { title: "Pending & reconciliation", text: "Server-side truth, webhook reconciliation, idempotency", week: 2, weightPct: 45 },
        { title: "Failure UX & tests", text: "Timeouts, retries, and tests for every terminal state", week: 3, weightPct: 20 },
      ],
    },
    {
      tenantSlug: "sentinel-labs", slug: "appsec-audit-sprint", title: "Threat Model & Security Audit", tier: "SPRINT",
      summary: "Threat-model a real open-source application, find and prove three classes of issue, and write the report.",
      categorySlug: "cybersecurity", techStack: ["burp", "semgrep", "threat-modelling"], weeksMin: 2, weeksMax: 3, mentorHours: 2,
      price: 7999, seniorPrice: 9999, principalPrice: 12499, ratingAvg: 4.6, ratingCount: 41, purchases: 88, difficulty: "Comfortable",
      rubricName: "Security rubric", criteria: SPRINT_CRITERIA,
      milestones: [
        { title: "Threat model", text: "Data-flow diagram, trust boundaries, ranked threats", week: 1, weightPct: 35 },
        { title: "Findings with proof", text: "Reproducible proof-of-concept for each finding", week: 2, weightPct: 40 },
        { title: "Report & remediation", text: "Developer-readable report with verified fixes", week: 3, weightPct: 25 },
      ],
    },
    {
      tenantSlug: "sentinel-labs", slug: "test-harness-sprint", title: "Flake-Free E2E Test Harness", tier: "SPRINT",
      summary: "Take a flaky suite from 12% failure noise to a trustworthy gate — with the data to prove it.",
      categorySlug: "qa-testing", techStack: ["playwright", "typescript", "github-actions"], weeksMin: 2, weeksMax: 3, mentorHours: 2,
      price: 4999, seniorPrice: 6499, principalPrice: 8499, ratingAvg: 4.5, ratingCount: 26, purchases: 63, difficulty: "Approachable",
      rubricName: "Quality rubric", criteria: SPRINT_CRITERIA,
      milestones: [
        { title: "Flake census", text: "Measure it before you fix it: quarantine and classify", week: 1, weightPct: 30 },
        { title: "Determinism", text: "Fixtures, network stubs and waits that are not sleeps", week: 2, weightPct: 45 },
        { title: "CI gate", text: "Sharded parallel run under ten minutes, with trend reporting", week: 3, weightPct: 25 },
      ],
    },
    {
      tenantSlug: "pixelforge", slug: "design-system-sprint", title: "Design System & Component Library", tier: "SPRINT",
      summary: "Ship a documented, accessible component library from a Figma file — tokens, variants, and a11y tests.",
      categorySlug: "product-design", techStack: ["figma", "react", "storybook"], weeksMin: 2, weeksMax: 4, mentorHours: 2,
      price: 5499, seniorPrice: 6999, principalPrice: 8999, ratingAvg: 4.4, ratingCount: 22, purchases: 57, difficulty: "Approachable",
      rubricName: "Design rubric", criteria: SPRINT_CRITERIA,
      milestones: [
        { title: "Token layer", text: "Extract tokens from Figma into a themeable pipeline", week: 1, weightPct: 30 },
        { title: "Components & states", text: "Ten components with every state and an a11y audit", week: 2, weightPct: 45 },
        { title: "Docs & adoption", text: "Storybook docs plus a migration guide for one real screen", week: 4, weightPct: 25 },
      ],
    },

    {
      tenantSlug: "cloudforge", slug: "load-test-sprint", title: "Load Test a Real API", tier: "SPRINT",
      summary: "Model the traffic, find the knee, and produce a capacity plan somebody can budget against.",
      categorySlug: "qa-testing", techStack: ["k6", "grafana", "postgres"], weeksMin: 2, weeksMax: 3, mentorHours: 2,
      price: 4499, seniorPrice: 5999, principalPrice: 7999, ratingAvg: 4.4, ratingCount: 18, purchases: 44, difficulty: "Approachable",
      rubricName: "Quality rubric", criteria: SPRINT_CRITERIA,
      milestones: [
        { title: "Traffic model", text: "Derive a load profile from real usage, not from a round number", week: 1, weightPct: 35 },
        { title: "Run & analyse", text: "Find the saturation point and the resource that causes it", week: 2, weightPct: 40 },
        { title: "Capacity plan", text: "Headroom, cost per request, and the scaling trigger", week: 3, weightPct: 25 },
      ],
    },
    {
      tenantSlug: "sentinel-labs", slug: "contract-testing-sprint", title: "Contract Testing Between Two Teams", tier: "SPRINT",
      summary: "Stop integration breakages at the PR instead of in staging — consumer-driven contracts, wired into CI.",
      categorySlug: "qa-testing", techStack: ["pact", "typescript", "github-actions"], weeksMin: 2, weeksMax: 3, mentorHours: 2,
      price: 4999, seniorPrice: 6499, principalPrice: 8499, ratingAvg: 4.3, ratingCount: 14, purchases: 31, difficulty: "Approachable",
      rubricName: "Quality rubric", criteria: SPRINT_CRITERIA,
      milestones: [
        { title: "Consumer contracts", text: "Write contracts from the consumer's real usage", week: 1, weightPct: 35 },
        { title: "Provider verification", text: "Verification job that fails the provider's build honestly", week: 2, weightPct: 40 },
        { title: "Broker & rollout", text: "Versioning strategy and the can-I-deploy gate", week: 3, weightPct: 25 },
      ],
    },
    {
      tenantSlug: "pixelforge", slug: "onboarding-redesign-sprint", title: "Redesign an Onboarding Flow", tier: "SPRINT",
      summary: "Research an existing flow, redesign it, and prove the change with a measured before-and-after.",
      categorySlug: "product-design", techStack: ["figma", "research", "analytics"], weeksMin: 2, weeksMax: 4, mentorHours: 2,
      price: 4999, seniorPrice: 6499, principalPrice: 8499, ratingAvg: 4.5, ratingCount: 17, purchases: 39, difficulty: "Approachable",
      rubricName: "Design rubric", criteria: SPRINT_CRITERIA,
      milestones: [
        { title: "Research & drop-off map", text: "Where people leave, and the evidence for why", week: 1, weightPct: 35 },
        { title: "Redesign & prototype", text: "A testable prototype with the rationale written down", week: 2, weightPct: 40 },
        { title: "Validation", text: "Five-user test with findings that survive scrutiny", week: 4, weightPct: 25 },
      ],
    },
    {
      tenantSlug: "pixelforge", slug: "analytics-instrumentation-sprint", title: "Product Analytics Instrumentation", tier: "SPRINT",
      summary: "Design an event taxonomy a whole team can use, instrument it, and build the funnel that answers a real question.",
      categorySlug: "product-design", techStack: ["analytics", "typescript", "sql"], weeksMin: 2, weeksMax: 3, mentorHours: 2,
      price: 4299, seniorPrice: 5499, principalPrice: 7499, ratingAvg: 4.2, ratingCount: 11, purchases: 26, difficulty: "Approachable",
      rubricName: "Design rubric", criteria: SPRINT_CRITERIA,
      milestones: [
        { title: "Event taxonomy", text: "Naming, properties and the governance doc", week: 1, weightPct: 35 },
        { title: "Instrumentation", text: "Typed tracking with tests that catch a broken event", week: 2, weightPct: 40 },
        { title: "Funnel & insight", text: "One funnel, one question answered, one recommendation", week: 3, weightPct: 25 },
      ],
    },
    {
      tenantSlug: "pixelforge", slug: "push-notifications-sprint", title: "Push Notifications That Don't Annoy", tier: "SPRINT",
      summary: "Delivery, deep links, quiet hours and preference management across both platforms.",
      categorySlug: "mobile-development", techStack: ["react-native", "fcm", "apns"], weeksMin: 2, weeksMax: 3, mentorHours: 2,
      price: 4999, seniorPrice: 6499, principalPrice: 8499, ratingAvg: 4.3, ratingCount: 15, purchases: 35, difficulty: "Approachable",
      rubricName: "Mobile rubric", criteria: SPRINT_CRITERIA,
      milestones: [
        { title: "Delivery pipeline", text: "Token lifecycle and delivery on both platforms", week: 1, weightPct: 35 },
        { title: "Deep links & state", text: "Cold-start deep links that land on the right screen", week: 2, weightPct: 40 },
        { title: "Preferences & quiet hours", text: "Per-category opt-outs the backend actually honours", week: 3, weightPct: 25 },
      ],
    },
    {
      tenantSlug: "sentinel-labs", slug: "siem-detection-sprint", title: "Detection Rules That Fire Once", tier: "SPRINT",
      summary: "Write, tune and validate detections against replayed attack traffic — and measure the false positive rate.",
      categorySlug: "cybersecurity", techStack: ["sigma", "elastic", "python"], weeksMin: 2, weeksMax: 4, mentorHours: 2,
      price: 6499, seniorPrice: 8499, principalPrice: 10499, ratingAvg: 4.5, ratingCount: 13, purchases: 29, difficulty: "Comfortable",
      rubricName: "Security rubric", criteria: SPRINT_CRITERIA,
      milestones: [
        { title: "Coverage map", text: "Map your telemetry to an attack framework and find the gaps", week: 1, weightPct: 30 },
        { title: "Detections", text: "Six rules validated against replayed attack traffic", week: 2, weightPct: 45 },
        { title: "Tuning & runbooks", text: "Measured false-positive rate plus a runbook per rule", week: 4, weightPct: 25 },
      ],
    },

    // ── Capstones (4–8 weeks, multiple checkpoints + defense) ──────────
    {
      tenantSlug: "cloudforge", slug: "k8s-operator-capstone", title: "Kubernetes Operator for Stateful Workloads", tier: "CAPSTONE",
      summary: "Write a real operator: CRDs, reconciliation loops, backups and the upgrade path that doesn't lose data.",
      categorySlug: "devops-cloud", techStack: ["go", "kubernetes", "controller-runtime"], weeksMin: 5, weeksMax: 8, mentorHours: 4,
      price: 22999, seniorPrice: 27999, principalPrice: 32999, ratingAvg: 4.8, ratingCount: 31, purchases: 71, difficulty: "Demanding",
      rubricName: "Platform rubric", criteria: SYSTEMS_CRITERIA, rubricVersion: 2,
      milestones: [
        { title: "CRD & API design", text: "Model the resource and its status subresource", week: 1, weightPct: 20 },
        { title: "Reconciliation loop", text: "Idempotent reconcile that converges from any state", week: 3, weightPct: 30 },
        { title: "Backup & restore", text: "Scheduled backups with a tested restore path", week: 5, weightPct: 30 },
        { title: "Upgrades & chaos", text: "Rolling version upgrade survived under fault injection", week: 7, weightPct: 20 },
      ],
    },
    {
      tenantSlug: "datawicket", slug: "feature-store-capstone", title: "Production Feature Store", tier: "CAPSTONE",
      summary: "Build offline/online feature parity with point-in-time correctness — the thing that quietly ruins models.",
      categorySlug: "data-science-ai", techStack: ["python", "spark", "redis", "dbt"], weeksMin: 4, weeksMax: 8, mentorHours: 4,
      price: 23999, seniorPrice: 28999, principalPrice: 33999, ratingAvg: 4.6, ratingCount: 24, purchases: 54, difficulty: "Demanding",
      rubricName: "ML rubric", criteria: SYSTEMS_CRITERIA, rubricVersion: 2,
      milestones: [
        { title: "Feature definitions", text: "A registry with typed, versioned feature definitions", week: 1, weightPct: 25 },
        { title: "Offline correctness", text: "Point-in-time joins with a leakage test suite", week: 3, weightPct: 35 },
        { title: "Online serving", text: "Low-latency online store with parity checks against offline", week: 6, weightPct: 40 },
      ],
    },
    {
      tenantSlug: "datawicket", slug: "fraud-detection-capstone", title: "Real-Time Fraud Detection Pipeline", tier: "CAPSTONE",
      summary: "Streaming features, a model under a 50ms budget, and an honest evaluation on heavily imbalanced data.",
      categorySlug: "data-science-ai", techStack: ["python", "kafka", "xgboost", "fastapi"], weeksMin: 5, weeksMax: 8, mentorHours: 4,
      price: 24999, seniorPrice: 29999, principalPrice: 34999, ratingAvg: 4.7, ratingCount: 19, purchases: 46, difficulty: "Demanding",
      rubricName: "ML rubric", criteria: SYSTEMS_CRITERIA, rubricVersion: 2,
      milestones: [
        { title: "Streaming features", text: "Windowed aggregates over the event stream", week: 1, weightPct: 25 },
        { title: "Model & threshold", text: "Cost-sensitive evaluation and a defensible threshold", week: 3, weightPct: 35 },
        { title: "Serving under budget", text: "p99 under 50ms with graceful degradation", week: 6, weightPct: 40 },
      ],
    },
    {
      tenantSlug: "pixelforge", slug: "offline-first-field-app", title: "Offline-First Field Operations App", tier: "CAPSTONE",
      summary: "A mobile app for patchy rural connectivity: local-first storage, sync, and conflict resolution you can explain.",
      categorySlug: "mobile-development", techStack: ["react-native", "sqlite", "typescript"], weeksMin: 4, weeksMax: 7, mentorHours: 4,
      price: 19999, seniorPrice: 24999, principalPrice: 29999, ratingAvg: 4.5, ratingCount: 27, purchases: 63, difficulty: "Demanding",
      rubricName: "Mobile rubric", criteria: SYSTEMS_CRITERIA, rubricVersion: 2,
      milestones: [
        { title: "Local-first data layer", text: "Schema, migrations and an offline write path", week: 1, weightPct: 25 },
        { title: "Sync engine", text: "Bidirectional sync with resumable transfers", week: 3, weightPct: 40 },
        { title: "Conflicts & field testing", text: "A conflict policy plus evidence from a throttled network", week: 6, weightPct: 35 },
      ],
    },
    {
      tenantSlug: "sentinel-labs", slug: "zero-trust-gateway-capstone", title: "Zero-Trust Access Gateway", tier: "CAPSTONE",
      summary: "Build an identity-aware proxy: short-lived credentials, per-request authorization, and a tamper-evident audit log.",
      categorySlug: "cybersecurity", techStack: ["go", "oidc", "postgres"], weeksMin: 5, weeksMax: 8, mentorHours: 4,
      price: 25999, seniorPrice: 30999, principalPrice: 35999, ratingAvg: 4.8, ratingCount: 16, purchases: 38, difficulty: "Demanding",
      rubricName: "Security rubric", criteria: SYSTEMS_CRITERIA, rubricVersion: 2,
      milestones: [
        { title: "Identity & sessions", text: "OIDC integration with short-lived, revocable sessions", week: 1, weightPct: 25 },
        { title: "Policy engine", text: "Per-request authorization with a testable policy language", week: 3, weightPct: 40 },
        { title: "Audit & threat model", text: "Append-only audit log and a written threat model", week: 6, weightPct: 35 },
      ],
    },

    // ── Flagships (seed-only tier — the studio UI can't create these) ──
    {
      tenantSlug: "demo-academy", slug: "search-platform-flagship", title: "Multi-Tenant Search Platform", tier: "FLAGSHIP",
      summary: "A twelve-week build: sharded index, tenant isolation, relevance tuning and a live defense in front of two mentors.",
      categorySlug: "system-design", techStack: ["go", "elasticsearch", "kafka", "kubernetes"], weeksMin: 10, weeksMax: 14, mentorHours: 10,
      price: 74999, seniorPrice: 89999, principalPrice: 109999, ratingAvg: 4.9, ratingCount: 11, purchases: 19, difficulty: "Severe",
      partnerCompanyName: "Meridian Retail Group",
      rubricName: "Flagship rubric", criteria: FLAGSHIP_CRITERIA,
      milestones: [
        { title: "Architecture & tenancy model", text: "Isolation strategy, capacity model and the failure domains", week: 2, weightPct: 20 },
        { title: "Indexing pipeline", text: "Ingestion, reindexing without downtime, backpressure", week: 5, weightPct: 25 },
        { title: "Relevance & evaluation", text: "Ranking with an offline relevance judgement set", week: 8, weightPct: 25 },
        { title: "Operations & defense prep", text: "SLOs, runbooks, load test evidence, defense deck", week: 11, weightPct: 30 },
      ],
    },
    {
      tenantSlug: "cloudforge", slug: "exchange-core-flagship", title: "Matching Engine & Exchange Core", tier: "FLAGSHIP",
      summary: "Build a deterministic order-matching engine with an event-sourced ledger, replay, and microsecond-scale latency targets.",
      categorySlug: "system-design", techStack: ["rust", "event-sourcing", "kafka"], weeksMin: 10, weeksMax: 16, mentorHours: 12,
      price: 89999, seniorPrice: 104999, principalPrice: 124999, ratingAvg: 5, ratingCount: 6, purchases: 11, difficulty: "Severe",
      partnerCompanyName: "Ashwin Capital",
      rubricName: "Flagship rubric", criteria: FLAGSHIP_CRITERIA,
      milestones: [
        { title: "Order book & matching", text: "Deterministic matching with price-time priority", week: 2, weightPct: 25 },
        { title: "Event-sourced ledger", text: "Append-only log with exact replay to any point in time", week: 5, weightPct: 25 },
        { title: "Latency engineering", text: "Allocation-free hot path with measured p99.9", week: 9, weightPct: 25 },
        { title: "Resilience & defense prep", text: "Failover, recovery drills, and the defense walkthrough", week: 13, weightPct: 25 },
      ],
    },
  ];

  for (const [pi, p] of PROJECTS.entries()) {
    const t = tenantBySlug[p.tenantSlug];
    const rubric = await ensureRubric(t.id, p.rubricName, p.criteria, p.rubricVersion ?? 1);
    const purchaseCount = p.purchases ?? 40;
    const project = await db.project.upsert({
      where: { tenantId_slug: { tenantId: t.id, slug: p.slug } },
      update: { ratingAvg: p.ratingAvg, ratingCount: p.ratingCount, status: "PUBLISHED", purchaseCount },
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
        difficulty: p.difficulty ?? null,
        partnerCompanyName: p.partnerCompanyName ?? null,
        durationWeeksMin: p.weeksMin,
        durationWeeksMax: p.weeksMax,
        mentorHoursBudget: p.mentorHours,
        status: "PUBLISHED",
        rubricId: rubric.id,
        heldOutEvalConfig: { harness: "private-suite", cases: p.tier === "FLAGSHIP" ? 60 : p.tier === "CAPSTONE" ? 24 : 12 },
        defenseRequired: p.tier !== "SPRINT",
        prerequisites: p.tier === "SPRINT" ? ["Comfortable in one language"] : ["A shipped project or equivalent experience"],
        outcomes: ["A reviewed, portfolio-ready build", "A verifiable credential with the rubric attached"],
        publishedAt: daysAgo(30 + ((pi * 11) % 90)),
        ratingAvg: p.ratingAvg,
        ratingCount: p.ratingCount,
        purchaseCount,
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
    await db.project.update({ where: { id: rtc.id }, data: { ratingAvg: 4.9, ratingCount: 47, purchaseCount: 112, categoryId: rtc.categoryId ?? catBySlug["web-development"] } });
    catalog["realtime-collab-editor"] = { kind: "PROJECT", id: rtc.id, tenantId: demoTenant.id, tenantSlug: "demo-academy", title: rtc.title, unitMinor: paise(19999) };
  }

  const publishedCourses = await db.course.count({ where: { status: "PUBLISHED", visibility: "MARKETPLACE" } });
  const publishedProjects = await db.project.count({ where: { status: "PUBLISHED", visibility: "MARKETPLACE" } });
  console.log(
    `  ✓ Catalog: ${COURSES.length} enrichment courses + ${DRAFTS.length} drafts, ${PROJECTS.length} projects ` +
      `→ ${publishedCourses} published courses / ${publishedProjects} published projects across 6 creator tenants`,
  );

  // ─────────────────────────────────────────────────────────────────────
  // Enrollments with varied progress ("Continue learning")
  // ─────────────────────────────────────────────────────────────────────
  const COURSE_SLUGS = [
    "fullstack-nextjs", "api-design-essentials", "python-data-analysis", "docker-kubernetes",
    "system-design-interview", "react-native-zero", "typescript-deep-dive", "ethical-hacking",
    "ml-foundations", "sql-mastery", "advanced-react-patterns", "aws-solutions-architect",
    "llm-engineering", "terraform-iac", "ci-cd-github-actions", "low-level-design-india",
    "web-app-security", "golang-for-backend", "playwright-e2e", "android-kotlin-jetpack",
    "distributed-systems-fundamentals", "python-mastery", "flutter-production", "database-internals",
    "unit-testing-tdd", "secure-coding-appsec", "product-management-tech", "deep-learning-pytorch",
    "node-microservices", "sre-observability",
  ];

  const ensureEnrollment = async (
    userId: string,
    slug: string,
    progressPct: number,
    source: "PURCHASE" | "SUBSCRIPTION" | "FREE" | "ADMIN_GRANT" | "ORG_LICENSE",
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
  // All four consumer-facing sources appear, so the dashboards and the org
  // reporting both have something to filter on.
  const sources = ["PURCHASE", "FREE", "SUBSCRIPTION", "ORG_LICENSE"] as const;
  const N = COURSE_SLUGS.length;
  for (const [i, l] of LEARNERS.entries()) {
    const uid = learnerUsers[l.email].id;
    const lapsed = LAPSED.has(l.email);
    // Lapsed learners started one thing and stopped; everyone else carries 3–4.
    const count = lapsed ? 1 : 3 + (i % 2);
    for (let j = 0; j < count; j++) {
      const slug = COURSE_SLUGS[(i * 3 + j * 7) % N];
      const progress = lapsed
        ? 4 + (i % 6)
        : j === 2 && i % 4 === 0
          ? 100
          : (i * 17 + j * 29 + 6) % 101;
      const lastActivity = lapsed ? daysAgo(70 + (i % 40)) : daysAgo((i * 2 + j * 3) % 21);
      await ensureEnrollment(uid, slug, progress, sources[(i + j) % sources.length], lastActivity);
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

  const enrollmentTotal = await db.enrollment.count();
  const completedEnrollments = await db.enrollment.count({ where: { status: "COMPLETED" } });
  const lapsedEnrollments = await db.enrollment.count({ where: { lastActivityAt: { lt: daysAgo(45) } } });
  console.log(
    `  ✓ Enrollments: ${enrollmentTotal} total (${enrollCount} generated) — ` +
      `${completedEnrollments} completed, ${lapsedEnrollments} lapsed (>45d idle)`,
  );

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

    // ── Wider spread: 2★–5★, including the honest criticism ────────────
    ["manish@learner.test", "docker-kubernetes", 3, "Good, but assumes Linux comfort", "Content is solid. I lost two evenings to environment problems the course doesn't cover."],
    ["siddharth@learner.test", "ethical-hacking", 3, "Labs are great, theory drags", "The lab work is worth the price. The first four hours of theory could be half as long."],
    ["varun@learner.test", "react-native-zero", 2, "Outdated in a few places", "Two modules reference an Expo API that's been deprecated. Support answered, but I'd wait for the update."],
    ["neha@learner.test", "python-data-analysis", 4, "Great for absolute beginners", "Very approachable. I'd have liked one more real-world messy dataset."],
    ["meghna@learner.test", "advanced-react-patterns", 5, "Changed how I structure components", "The state-machine module alone paid for the course. Dense, but every minute counts."],
    ["abhishek@learner.test", "advanced-react-patterns", 4, "Strong, needs a prerequisite warning", "Excellent content but genuinely advanced — don't start here if hooks are still new."],
    ["lavanya@learner.test", "advanced-react-patterns", 5, "Best React content I've paid for", "Finally understand why our re-render problems happen."],
    ["ritika@learner.test", "node-microservices", 4, "Honest about the downsides", "Rare to find a microservices course that tells you when not to split. Appreciated."],
    ["joel@learner.test", "node-microservices", 3, "Heavy on theory early", "Gets excellent from module four onward. Push through the first section."],
    ["kavya@learner.test", "tailwind-design-systems", 5, "Our team adopted this structure", "We rebuilt our component library following this. Genuinely useful at work."],
    ["yusuf@learner.test", "tailwind-design-systems", 4, "Practical and short", "Twelve hours well spent. Wanted more on dark mode."],
    ["pallavi@learner.test", "django-rest-production", 4, "The ORM tuning section is gold", "Everything else you can find free. That one module you can't."],
    ["hemant@learner.test", "django-rest-production", 3, "Solid but a bit dry", "Accurate content, flat delivery. Worth it if you already work in Django."],
    ["ananya@learner.test", "aws-solutions-architect", 5, "Passed the SAA and understood it", "Not a cram course — it actually teaches the reasoning behind the service choices."],
    ["vikram@learner.test", "aws-solutions-architect", 4, "Great depth, long", "Thirty hours is real. Block out a month."],
    ["rohit@learner.test", "terraform-iac", 5, "The state chapter saved our team", "We were doing state completely wrong. This fixed it in an afternoon."],
    ["isha@learner.test", "terraform-iac", 4, "Very practical", "Module structure advice is exactly what I needed for a growing repo."],
    ["sana@learner.test", "sre-observability", 5, "SLOs finally clicked", "The burn-rate alerting section changed how our on-call works."],
    ["aryan@learner.test", "ci-cd-github-actions", 4, "Perfect for a first pipeline", "Short, clear, immediately applicable. Caching section is great."],
    ["diya@learner.test", "ci-cd-github-actions", 5, "Cut our CI from 14 to 4 minutes", "Applied it the same week. Enormous value for the price."],
    ["nikita@learner.test", "distributed-systems-fundamentals", 5, "Rigorous without being academic", "The Raft walkthrough is the clearest I've seen anywhere."],
    ["karan@learner.test", "distributed-systems-fundamentals", 4, "Hard, in a good way", "You will need to rewatch things. That's the point."],
    ["tanvi@learner.test", "event-driven-kafka", 4, "Honest about exactly-once", "Refreshing to hear someone explain what the guarantees actually mean."],
    ["farhan@learner.test", "database-internals", 5, "I read query plans now", "Went from guessing at indexes to reasoning about them."],
    ["pooja@learner.test", "low-level-design-india", 5, "Cleared two machine-coding rounds", "The 90-minute practice format is exactly like the real thing."],
    ["imran@learner.test", "low-level-design-india", 4, "Good drills, thin on theory", "The practice sessions are worth it even if the SOLID module is basic."],
    ["shalini@learner.test", "flutter-production", 4, "Release engineering section is rare", "Most Flutter courses stop at the UI. This one doesn't."],
    ["devansh@learner.test", "flutter-production", 3, "Solid but state chapter is opinionated", "Good content. Presents one state solution as the answer."],
    ["gagan@learner.test", "android-kotlin-jetpack", 5, "Compose finally makes sense", "The mental model section was the missing piece."],
    ["anushka@learner.test", "android-kotlin-jetpack", 4, "Comprehensive", "Twenty-seven hours but nothing is filler."],
    ["swati@learner.test", "ios-swiftui", 3, "Fine for a first iOS course", "Gets you to a TestFlight build. Don't expect depth."],
    ["raghav@learner.test", "ios-swiftui", 4, "Well paced", "Good for someone coming from web."],
    ["meghna@learner.test", "web-app-security", 5, "Actually teaches the fix, not just the exploit", "Most security courses stop at the proof of concept. This one makes you remediate."],
    ["abhishek@learner.test", "web-app-security", 4, "Labs are excellent", "The reporting module is unexpectedly useful."],
    ["lavanya@learner.test", "cloud-security-aws", 4, "Dense and worth it", "IAM section is the best treatment I've found."],
    ["ritika@learner.test", "soc-analyst-blue-team", 3, "Good intro, wanted more hunting", "Triage content is strong. The hunting module felt short."],
    ["joel@learner.test", "secure-coding-appsec", 5, "Every backend dev should do this", "Fourteen hours that will change how you write code."],
    ["kavya@learner.test", "golang-for-backend", 5, "Best Go course for people who already code", "Skips the syntax tour and gets to concurrency properly."],
    ["yusuf@learner.test", "golang-for-backend", 4, "Great, assumes experience", "Not a first programming language course, and it says so."],
    ["pallavi@learner.test", "rust-systems-programming", 4, "Borrow checker finally stopped fighting me", "Steep, but the lifetimes module is worth the whole price."],
    ["hemant@learner.test", "python-mastery", 5, "The asyncio module alone", "I've written Python for four years and learned plenty."],
    ["neha@learner.test", "python-mastery", 4, "Great refresher", "Packaging section is more useful than I expected."],
    ["manish@learner.test", "playwright-e2e", 5, "Our flake rate went to near zero", "The determinism chapter is the whole reason to buy this."],
    ["siddharth@learner.test", "unit-testing-tdd", 4, "Sensible, not dogmatic", "Appreciated the 'what not to test' section."],
    ["varun@learner.test", "api-test-automation", 3, "Fine but basic", "Good if you're new to it. Not much here for experienced QA."],
    ["nikita@learner.test", "performance-testing-k6", 5, "Percentiles chapter is essential", "I'd been reading averages for years. Embarrassing and fixable."],
    ["karan@learner.test", "solidity-smart-contracts", 3, "Good fundamentals, moves fast", "Foundry coverage is current. Gas section could be deeper."],
    ["tanvi@learner.test", "web3-dapp-engineering", 2, "Frontend content feels rushed", "The chain-side material is decent but the React sections skip too much."],
    ["rohit@learner.test", "smart-contract-security", 5, "Worth every rupee", "The audit report template is something I still use professionally."],
    ["diya@learner.test", "product-management-tech", 4, "Useful for a tech lead", "Prioritisation module gave me language for conversations I was already having."],
    ["ananya@learner.test", "ux-design-foundations", 4, "Good grounding for engineers", "Five-user testing section is immediately practical."],
    ["isha@learner.test", "figma-to-code", 5, "Fixed our handoff", "Token pipeline section paid for itself the first sprint."],
    ["sana@learner.test", "llm-engineering", 4, "Evals module is the differentiator", "Everyone teaches RAG. Almost nobody teaches how to know it works."],
    ["aryan@learner.test", "llm-engineering", 5, "Cost control chapter saved us real money", "Cut our token spend by 60% using exactly this."],
    ["vikram@learner.test", "deep-learning-pytorch", 4, "Debugging section is the standout", "Training loops you can actually reason about."],
    ["meghna@learner.test", "data-engineering-airflow", 3, "Solid, dbt section is light", "Airflow content is excellent. dbt gets one module and needs three."],
    ["abhishek@learner.test", "mobile-app-performance", 5, "Cut cold start by 40%", "Real traces, real fixes. Short and extremely dense."],
  ];
  for (const [email, slug, rating, title, body] of courseReviews) {
    await ensureCourseReview(learnerUsers[email].id, slug, rating, title, body);
  }

  const projectReviews: Array<[string, string, number, string, string]> = [
    ["ananya@learner.test", "realtime-collab-editor", 5, "The mentor review made it", "Ambiguous brief pushed me to make real decisions. Feedback was sharp."],
    ["rohit@learner.test", "distributed-rate-limiter", 5, "Interview-ready portfolio piece", "Exactly the kind of systems work employers ask about."],
    ["vikram@learner.test", "distributed-rate-limiter", 4, "Hard and worth it", "The held-out evaluation caught two bugs I was sure weren't there."],
    ["meghna@learner.test", "k8s-operator-capstone", 5, "This got me the job", "The reviewer pushed back on my reconcile logic twice. Both times he was right."],
    ["abhishek@learner.test", "url-shortener-sprint", 4, "Great two-week scope", "Tight, finishable, and the caching feedback was specific."],
    ["lavanya@learner.test", "url-shortener-sprint", 3, "Good but shorter than advertised", "Finished in nine days. Would have liked an optional stretch milestone."],
    ["ritika@learner.test", "llm-rag-sprint", 5, "The eval milestone is the point", "Anyone can build RAG. This makes you prove it works."],
    ["joel@learner.test", "observability-sprint", 4, "Immediately useful at work", "Took the tracing setup straight into our platform."],
    ["kavya@learner.test", "deploy-pipeline-sprint", 5, "Canary module was excellent", "Mentor caught that my rollback wasn't actually tested. Fair."],
    ["shalini@learner.test", "offline-first-field-app", 4, "Conflict resolution is genuinely hard", "The mentor made me justify my policy. That conversation was the value."],
    ["yusuf@learner.test", "appsec-audit-sprint", 5, "Report template is professional-grade", "I've used this format in a real engagement since."],
    ["pallavi@learner.test", "test-harness-sprint", 4, "Fixed our real suite", "Applied the quarantine approach at work the same month."],
    ["nikita@learner.test", "search-platform-flagship", 5, "The hardest thing I've built", "Twelve weeks, two mentors, and a defense that genuinely tested me. No regrets."],
    ["farhan@learner.test", "ml-recommender", 4, "Honest evaluation focus", "The error-analysis milestone was uncomfortable and necessary."],
    ["kavya@learner.test", "contract-testing-sprint", 4, "Ended a long-running argument", "Two teams, one contract. The can-I-deploy gate settled it."],
    ["anushka@learner.test", "onboarding-redesign-sprint", 5, "The validation milestone is the point", "Anyone can redesign a screen. Proving it worked is the skill."],
    ["manish@learner.test", "load-test-sprint", 3, "Good, but very short", "Solid content. Two weeks felt like one and a half."],
    ["pooja@learner.test", "siem-detection-sprint", 5, "Best detection engineering exercise I've done", "Replayed attack traffic makes it real in a way tutorials don't."],
    ["shalini@learner.test", "push-notifications-sprint", 4, "The quiet-hours milestone is underrated", "Deep-link cold start took me three attempts. Worth it."],
    ["arjun-placeholder", "checkout-service", 4, "Great sprint", "Tight scope, strong feedback on idempotency and retries."],
  ];
  for (const [email, slug, rating, title, body] of projectReviews) {
    const uid = email === "arjun-placeholder" ? arjun.id : learnerUsers[email]?.id;
    if (uid) await ensureProjectReview(uid, slug, rating, title, body);
  }

  const reviewSpread = await db.catalogReview.groupBy({ by: ["rating"], _count: { _all: true } });
  console.log(
    `  ✓ Catalog reviews: ${courseReviews.length + projectReviews.length} published — ` +
      reviewSpread.sort((a, b) => b.rating - a.rating).map((r) => `${r.rating}★×${r._count._all}`).join(" "),
  );

  // ─────────────────────────────────────────────────────────────────────
  // Cohorts + upcoming live sessions ("Next live")
  // ─────────────────────────────────────────────────────────────────────
  const ensureCohort = async (
    slug: string,
    cohortSlug: string,
    name: string,
    status: "DRAFT" | "OPEN" | "RUNNING" | "COMPLETED" | "CANCELLED",
    startsAt: Date,
    endsAt: Date | null,
    capacity: number,
    enrollmentClosesAt: Date | null = daysFromNow(2),
  ) => {
    const entry = catalog[slug];
    if (!entry) return null;
    return db.cohort.upsert({
      where: { courseId_slug: { courseId: entry.id, slug: cohortSlug } },
      update: { status },
      create: {
        courseId: entry.id,
        name,
        slug: cohortSlug,
        description: `${name} — live sessions twice a week, recordings within 24 hours.`,
        startsAt,
        endsAt,
        status,
        capacity,
        enrollmentClosesAt,
      },
    });
  };

  const fsRunning = await ensureCohort("fullstack-nextjs", "jul-2026", "July 2026 Live Cohort", "RUNNING", daysAgo(14), daysFromNow(42), 40);
  const dkRunning = await ensureCohort("docker-kubernetes", "dk8s-jul-2026", "DevOps July Cohort", "RUNNING", daysAgo(7), daysFromNow(49), 35);
  const sdOpen = await ensureCohort("system-design-interview", "sysd-sep-2026", "September Interview Sprint", "OPEN", daysFromNow(30), daysFromNow(75), 50);
  // Every CohortStatus represented, so the studio cohort list is not one-note.
  const llmOpen = await ensureCohort("llm-engineering", "llm-oct-2026", "October LLM Build Cohort", "OPEN", daysFromNow(18), daysFromNow(60), 45, daysFromNow(12));
  const sreRunning = await ensureCohort("sre-observability", "sre-aug-2026", "August Reliability Cohort", "RUNNING", daysAgo(21), daysFromNow(21), 30);
  await ensureCohort("system-design-interview", "sysd-mar-2026", "March Interview Sprint", "COMPLETED", daysAgo(180), daysAgo(120), 50, daysAgo(185));
  await ensureCohort("docker-kubernetes", "dk8s-feb-2026", "February DevOps Cohort", "COMPLETED", daysAgo(210), daysAgo(150), 35, daysAgo(215));
  await ensureCohort("node-microservices", "node-nov-2026", "November Microservices Cohort", "DRAFT", daysFromNow(75), daysFromNow(130), 30, daysFromNow(68));
  await ensureCohort("ethical-hacking", "eh-jun-2026", "June Red Team Cohort", "CANCELLED", daysAgo(60), daysAgo(10), 25, daysAgo(70));

  // enroll arjun + a few learners into the running fullstack cohort so "Next live" shows
  if (fsRunning) {
    await ensureEnrollment(arjun.id, "fullstack-nextjs", 45, "PURCHASE", daysAgo(1), fsRunning.id);
    await ensureEnrollment(learnerUsers["ananya@learner.test"].id, "fullstack-nextjs", 62, "PURCHASE", daysAgo(2), fsRunning.id);
    await ensureEnrollment(learnerUsers["rohit@learner.test"].id, "fullstack-nextjs", 40, "SUBSCRIPTION", daysAgo(3), fsRunning.id);
    await ensureEnrollment(learnerUsers["meghna@learner.test"].id, "fullstack-nextjs", 58, "PURCHASE", daysAgo(1), fsRunning.id);
    await ensureEnrollment(learnerUsers["abhishek@learner.test"].id, "fullstack-nextjs", 33, "SUBSCRIPTION", daysAgo(4), fsRunning.id);
  }
  if (dkRunning) {
    await ensureEnrollment(learnerUsers["lavanya@learner.test"].id, "docker-kubernetes", 48, "PURCHASE", daysAgo(2), dkRunning.id);
    await ensureEnrollment(learnerUsers["joel@learner.test"].id, "docker-kubernetes", 25, "SUBSCRIPTION", daysAgo(5), dkRunning.id);
  }
  if (sreRunning) {
    await ensureEnrollment(learnerUsers["ritika@learner.test"].id, "sre-observability", 71, "PURCHASE", daysAgo(1), sreRunning.id);
    await ensureEnrollment(learnerUsers["kavya@learner.test"].id, "sre-observability", 44, "PURCHASE", daysAgo(3), sreRunning.id);
  }

  const ensureLive = async (
    ref: string,
    tenantId: string,
    hostUserId: string,
    purpose: "COHORT_CLASS" | "WEBINAR" | "AMA" | "MENTOR_CHECKPOINT" | "DEFENSE" | "PROGRAM_SESSION",
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
  await ensureLive("seed-live-7", cloudforge.id, nikhil.id, "COHORT_CLASS", "Designing SLOs your team will actually defend", daysFromNow(1), 90, { courseId: catalog["sre-observability"].id, cohortId: sreRunning?.id });
  await ensureLive("seed-live-8", cloudforge.id, mentorHarish.id, "COHORT_CLASS", "Incident review workshop: a real postmortem", daysFromNow(8), 120, { courseId: catalog["sre-observability"].id, cohortId: sreRunning?.id });
  await ensureLive("seed-live-9", datawicket.id, shreya.id, "WEBINAR", "Webinar: what an LLM eval suite looks like", daysFromNow(4), 60, { courseId: catalog["llm-engineering"].id, cohortId: llmOpen?.id });
  await ensureLive("seed-live-10", datawicket.id, mentorPriyanka.id, "AMA", "AMA: moving from analytics into ML engineering", daysFromNow(12), 60, {});
  await ensureLive("seed-live-11", sentinel.id, meera.id, "WEBINAR", "Webinar: threat modelling in 45 minutes", daysFromNow(9), 45, { courseId: catalog["web-app-security"].id });
  await ensureLive("seed-live-12", pixelforge.id, mentorAnkita.id, "AMA", "AMA: shipping Indian-market mobile apps", daysFromNow(14), 60, {});
  await ensureLive("seed-live-13", codecraft.id, gaurav.id, "WEBINAR", "Webinar: TypeScript types that pay rent", daysFromNow(16), 60, { courseId: catalog["typescript-deep-dive"].id });

  const cohortCounts = await db.cohort.groupBy({ by: ["status"], _count: { _all: true } });
  const liveCount = await db.liveSession.count();
  console.log(
    `  ✓ Cohorts (${cohortCounts.map((c) => `${c._count._all} ${c.status}`).join(", ")}) + ${liveCount} live sessions`,
  );

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

  await seedThread("aws-solutions-architect", "Multi-AZ vs multi-region for a ₹5cr/yr product?", "QUESTION", "abhishek@learner.test",
    "Finance is pushing back on the multi-region bill. How do you make the case, or accept multi-AZ?", [
      { email: "ritika@learner.test", text: "Put a number on it: expected downtime × revenue per hour. Multi-AZ usually wins until that number crosses the cost delta.", accepted: true },
      { email: "joel@learner.test", text: "Also ask what your RPO actually is. Most teams discover it's much looser than they claimed." },
    ]);
  await seedThread("system-design-interview", "How much capacity estimation do interviewers really want?", "QUESTION", "nikita@learner.test",
    "I keep burning eight minutes on back-of-envelope numbers. Is that time well spent?", [
      { email: "meghna@learner.test", text: "Two minutes, out loud, then move on. They want to see you can, not watch you do it.", accepted: true },
      { email: "karan@learner.test", text: "Agreed — and state your assumptions so they can correct you early." },
    ]);
  await seedThread("llm-engineering", "Are offline evals worth it for a small app?", "DISCUSSION", "sana@learner.test",
    "We have maybe 200 users. Does an eval suite pay for itself at that scale?", [
      { email: "aryan@learner.test", text: "The suite is cheap; the regression you ship without it is not. Twenty golden examples is enough to start." },
      { email: "lavanya@learner.test", text: "We started with 15 and it caught a prompt change that broke citations." },
    ]);
  await seedThread("web-app-security", "Reporting a finding to a team that doesn't want it", "QUESTION", "yusuf@learner.test",
    "Found a real IDOR. The owning team says it's low priority. How do you escalate without burning the relationship?", [
      { email: "meghna@learner.test", text: "Write the exploit as a failing test in their repo. It stops being an opinion.", accepted: true },
    ]);
  await seedThread("docker-kubernetes", "Do I need a service mesh at 12 services?", "DISCUSSION", "manish@learner.test",
    "Everyone says yes eventually. Is twelve services eventually?", [
      { email: "kavya@learner.test", text: "No. Get tracing and mTLS via your ingress first — you'll learn what you actually need." },
      { email: "joel@learner.test", text: "We added one at 40 services and regretted not waiting longer." },
    ]);

  const threadCount = await db.discussionThread.count();
  console.log(`  ✓ Discussion threads: ${threadCount} with replies + accepted answers`);

  // ─────────────────────────────────────────────────────────────────────
  // Assessment activity: assignment submissions + quiz attempts
  //
  // The studio grading queue reads AssignmentSubmission by status, so this
  // deliberately leaves a healthy backlog of SUBMITTED / RESUBMIT_REQUESTED
  // work spread across tenants — plus graded history to compare against.
  // ─────────────────────────────────────────────────────────────────────
  const staffIds: Record<string, string> = {
    "creator@demo.test": cora.id,
    "gaurav@codecraft.test": gaurav.id,
    "shreya@datawicket.test": shreya.id,
    "nikhil@cloudforge.test": nikhil.id,
    "meera@sentinel.test": meera.id,
    "ritu@pixelforge.test": ritu.id,
  };
  const userIdFor = (email: string): string | undefined =>
    email === "arjun" ? arjun.id : (learnerUsers[email]?.id ?? staffIds[email]);

  const enrollmentFor = async (userId: string, courseSlug: string, fallbackProgress: number) => {
    const entry = catalog[courseSlug];
    if (!entry || entry.kind !== "COURSE") return null;
    const existing = await db.enrollment.findFirst({ where: { userId, courseId: entry.id } });
    if (existing) return existing;
    return ensureEnrollment(userId, courseSlug, fallbackProgress, "PURCHASE", daysAgo(3));
  };

  type SubmissionSpec = {
    email: string;
    slug: string;
    status: "DRAFT" | "SUBMITTED" | "GRADING" | "GRADED" | "RETURNED" | "RESUBMIT_REQUESTED";
    days: number;
    text: string;
    repo?: string;
    late?: boolean;
    score?: number;
    feedback?: string;
    graderEmail?: string;
    attemptNo?: number;
  };

  const ensureSubmission = async (s: SubmissionSpec) => {
    const entry = catalog[s.slug];
    if (!entry || entry.kind !== "COURSE") return null;
    const uid = userIdFor(s.email);
    if (!uid) return null;
    const assignment = await db.assignment.findFirst({ where: { lesson: { courseId: entry.id } } });
    if (!assignment) return null;
    const enrollment = await enrollmentFor(uid, s.slug, 72);
    if (!enrollment) return null;
    const attemptNo = s.attemptNo ?? 1;
    const existing = await db.assignmentSubmission.findUnique({
      where: { assignmentId_userId_attemptNo: { assignmentId: assignment.id, userId: uid, attemptNo } },
    });
    if (existing) return existing;
    const graded = s.status === "GRADED" || s.status === "RETURNED" || s.status === "RESUBMIT_REQUESTED";
    const graderId = s.graderEmail ? userIdFor(s.graderEmail) : null;
    return db.assignmentSubmission.create({
      data: {
        assignmentId: assignment.id,
        userId: uid,
        enrollmentId: enrollment.id,
        attemptNo,
        text: s.text,
        repoUrl: s.repo ?? null,
        status: s.status,
        submittedAt: s.status === "DRAFT" ? null : daysAgo(s.days),
        late: s.late ?? false,
        scorePoints: graded ? (s.score ?? 72) : null,
        feedback: graded && s.feedback ? { text: s.feedback } : undefined,
        gradedById: graded ? (graderId ?? tenantBySlug[entry.tenantSlug]?.creatorId ?? null) : null,
        gradedAt: graded ? daysAgo(Math.max(0, s.days - 2)) : null,
      },
    });
  };

  const SUBMISSIONS: SubmissionSpec[] = [
    // ── Pending: waiting on a human (the grading queue) ────────────────
    { email: "meghna@learner.test", slug: "advanced-react-patterns", status: "SUBMITTED", days: 1, text: "Refactored the dashboard to a state machine. The compound-component API is in src/components/panel — I'd like feedback on whether the context split is too granular.", repo: "https://github.com/meghna-s/react-patterns-capstone" },
    { email: "abhishek@learner.test", slug: "node-microservices", status: "SUBMITTED", days: 2, text: "Three services plus an outbox worker. I chose at-least-once with idempotency keys rather than trying for exactly-once — reasoning is in DECISIONS.md.", repo: "https://github.com/arathore/order-fanout" },
    { email: "lavanya@learner.test", slug: "aws-solutions-architect", status: "SUBMITTED", days: 1, text: "Architecture doc plus a Terraform stack for the multi-AZ design. Cost model in the spreadsheet link at the bottom of the README.", repo: "https://github.com/lkrishnan/saa-capstone" },
    { email: "ritika@learner.test", slug: "sre-observability", status: "SUBMITTED", days: 3, text: "SLOs for the checkout path with burn-rate alerts. I could not get the multi-window alert to stop flapping under synthetic load — that's my open question.", repo: "https://github.com/ritika-a/slo-workshop" },
    { email: "joel@learner.test", slug: "terraform-iac", status: "SUBMITTED", days: 4, late: true, text: "Late, sorry — module refactor took longer than planned. State migration script is in scripts/migrate-state.sh and I tested it against a copy.", repo: "https://github.com/joelf/tf-modules" },
    { email: "kavya@learner.test", slug: "golang-for-backend", status: "SUBMITTED", days: 2, text: "Worker pool with graceful shutdown. I'm not confident about the context cancellation in the retry path.", repo: "https://github.com/kavyas/go-worker-pool" },
    { email: "yusuf@learner.test", slug: "web-app-security", status: "SUBMITTED", days: 1, text: "Five findings against the target app, each with a reproducible PoC. Report follows the template from module 6.", repo: "https://github.com/yansari/appsec-report" },
    { email: "pallavi@learner.test", slug: "playwright-e2e", status: "SUBMITTED", days: 5, late: true, text: "Flake rate went from 11% to 0.4% over 200 runs. Evidence in the CI artifacts. Ran over the deadline because I wanted the full run history.", repo: "https://github.com/pallavi-d/e2e-harness" },
    { email: "gagan@learner.test", slug: "android-kotlin-jetpack", status: "SUBMITTED", days: 2, text: "Compose app with offline caching. Play Store internal-track build link is in the README.", repo: "https://github.com/gagandeep-s/compose-field-notes" },
    { email: "shalini@learner.test", slug: "flutter-production", status: "SUBMITTED", days: 3, text: "Riverpod for state, platform channel for the barcode scanner. Release pipeline is set up but I haven't shipped a build yet.", repo: "https://github.com/shalinip/flutter-inventory" },
    { email: "anushka@learner.test", slug: "ux-design-foundations", status: "SUBMITTED", days: 4, text: "Research synthesis from five interviews plus a revised IA. Figma prototype link in the write-up.", repo: "https://github.com/anushkab/ux-foundations-capstone" },
    { email: "hemant@learner.test", slug: "python-mastery", status: "SUBMITTED", days: 6, late: true, text: "Typed async scraper, published to TestPyPI. Late because the packaging module took me three attempts.", repo: "https://github.com/hemantc/asyncscrape" },
    { email: "sana@learner.test", slug: "llm-engineering", status: "SUBMITTED", days: 2, text: "RAG pipeline with a 40-example eval set. Recall@5 is 0.82; I've documented where it fails.", repo: "https://github.com/sanakapoor/doc-assistant" },
    { email: "manish@learner.test", slug: "docker-kubernetes", status: "SUBMITTED", days: 7, late: true, text: "Deployment manifests plus a rollout with readiness gates. I'm unsure whether my PDB settings are right.", repo: "https://github.com/manishk/k8s-rollout" },

    // ── Sent back for another attempt (still in the queue) ─────────────
    { email: "devansh@learner.test", slug: "flutter-production", status: "RESUBMIT_REQUESTED", days: 9, score: 48, text: "First pass at the inventory app. State is all in setState right now.", repo: "https://github.com/devansht/flutter-inventory", feedback: "Good UI work, but the brief asked for a state solution you can defend at scale — setState across twelve screens isn't it. Pick one approach, apply it consistently, and write two paragraphs on why. Resubmit when that's done.", graderEmail: "ritu@pixelforge.test" },
    { email: "imran@learner.test", slug: "low-level-design-india", status: "RESUBMIT_REQUESTED", days: 11, score: 52, text: "Parking-lot design with class diagram and code.", repo: "https://github.com/imrans/lld-parking", feedback: "Your class diagram and your code disagree in three places. Reconcile them, then add the extension you claimed was 'easy to add' — that claim is the thing being tested.", graderEmail: "creator@demo.test" },
    { email: "varun@learner.test", slug: "unit-testing-tdd", status: "RESUBMIT_REQUESTED", days: 8, score: 44, text: "Test suite for the cart module, 91% coverage.", repo: "https://github.com/varunp/cart-tests", feedback: "91% coverage with assertions that can't fail isn't coverage. Six of your tests assert only that a function returned without throwing. Rewrite those around behaviour and resubmit.", graderEmail: "gaurav@codecraft.test" },
    { email: "swati@learner.test", slug: "ios-swiftui", status: "RESUBMIT_REQUESTED", days: 14, score: 39, text: "SwiftUI app, three screens.", repo: "https://github.com/swatib/swiftui-notes", feedback: "The app builds and runs, which is a real start. It's missing the persistence layer and the TestFlight build the brief asks for. Both are covered in module 5 — work through it and come back.", graderEmail: "ritu@pixelforge.test" },
    { email: "raghav@learner.test", slug: "api-test-automation", status: "RESUBMIT_REQUESTED", days: 12, score: 41, text: "Postman collection with 30 requests.", repo: "https://github.com/raghavn/api-pack", feedback: "A collection isn't a regression pack until it runs in CI and fails loudly. Add the Newman step and a contract test for at least one endpoint.", graderEmail: "meera@sentinel.test" },

    // ── Mid-grade (a human has it open) ────────────────────────────────
    { email: "nikita@learner.test", slug: "distributed-systems-fundamentals", status: "GRADING", days: 3, text: "Implemented Raft leader election with a partition test harness. The log replication section is deliberately simplified — explained in the README.", repo: "https://github.com/nikitarao/mini-raft" },
    { email: "ananya@learner.test", slug: "system-design-interview", status: "GRADING", days: 2, text: "Design doc for a ride-hailing dispatch system with capacity estimates and three failure scenarios.", repo: "https://github.com/ananyad/dispatch-design" },

    // ── Graded history ─────────────────────────────────────────────────
    { email: "vikram@learner.test", slug: "fullstack-nextjs", status: "GRADED", days: 21, score: 92, text: "Booking app schema with the availability model normalised out. Wrote up why I avoided a materialised availability table.", repo: "https://github.com/vikrammenon/booking-schema", feedback: "Excellent. The availability reasoning is exactly the kind of tradeoff analysis this assignment is for. Minor: your unique constraint on bookings allows a double-book across timezones.", graderEmail: "creator@demo.test" },
    { email: "isha@learner.test", slug: "typescript-deep-dive", status: "GRADED", days: 26, score: 88, text: "Declaration file for the legacy SDK plus generic helpers for the request layer.", repo: "https://github.com/ishareddy/ts-sdk-types", feedback: "Strong generic work. The conditional type in request.ts is doing more than it needs to — a simpler overload would read better for the next person.", graderEmail: "gaurav@codecraft.test" },
    { email: "rohit@learner.test", slug: "docker-kubernetes", status: "GRADED", days: 18, score: 79, text: "Multi-stage Dockerfiles and a Helm chart with configurable resources.", repo: "https://github.com/rohitm/k8s-chart", feedback: "Solid. Your images are 40% larger than they need to be — the build cache layer isn't being discarded. Otherwise production-ready.", graderEmail: "creator@demo.test" },
    { email: "diya@learner.test", slug: "ml-foundations", status: "GRADED", days: 24, score: 85, text: "Baseline plus gradient boosting on the churn dataset, with a leakage audit.", repo: "https://github.com/diyanair/churn-baseline", feedback: "The leakage audit is the best part — you caught the post-hoc feature. Your test set is a little small for the confidence intervals you quote.", graderEmail: "shreya@datawicket.test" },
    { email: "karan@learner.test", slug: "ethical-hacking", status: "GRADED", days: 15, score: 74, text: "Full engagement report against the lab target with remediation steps.", repo: "https://github.com/karanb/pentest-report", feedback: "Findings are accurate and well-evidenced. The executive summary is written for engineers, not executives — rewrite that section for the audience it names.", graderEmail: "gaurav@codecraft.test" },
    { email: "aryan@learner.test", slug: "sql-mastery", status: "GRADED", days: 19, score: 95, text: "Rewrote the six slow reports using window functions; before/after plans included.", repo: "https://github.com/aryanjoshi/sql-tuning", feedback: "Outstanding. The plan-by-plan comparison is exactly the evidence I want to see. Nothing to fix.", graderEmail: "shreya@datawicket.test" },
    { email: "tanvi@learner.test", slug: "ci-cd-github-actions", status: "GRADED", days: 13, score: 81, text: "Pipeline with matrix builds, caching and an environment-gated deploy.", repo: "https://github.com/tanvishah/ci-pipeline", feedback: "Good pipeline. Your deploy job has write permissions it doesn't need — scope the token down.", graderEmail: "gaurav@codecraft.test" },
    { email: "pooja@learner.test", slug: "secure-coding-appsec", status: "GRADED", days: 17, score: 77, text: "Threat model for the payments feature plus three hardening PRs.", repo: "https://github.com/poojaiyer/appsec-threat-model", feedback: "The threat model is thorough. Two of your three PRs fix symptoms rather than the shared root cause in the validation layer.", graderEmail: "meera@sentinel.test" },
    { email: "farhan@learner.test", slug: "react-native-zero", status: "GRADED", days: 28, score: 68, text: "Expo app with navigation and a local store, published to the internal track.", repo: "https://github.com/farhans/rn-first-app", feedback: "It ships, which is the bar for this one. Navigation state isn't persisted across cold starts — worth fixing before you show this to anyone.", graderEmail: "gaurav@codecraft.test" },
    { email: "arjun", slug: "docker-kubernetes", status: "GRADED", days: 7, score: 90, text: "Containerised our internal platform API and wrote the rollout runbook, including the deprecation policy for the old deployment.", repo: "https://github.com/arjunrao/platform-rollout", feedback: "Clear and immediately usable. The rollback window is more generous than most teams can sustain — worth pressure-testing.", graderEmail: "creator@demo.test" },

    // ── Graded and handed back to the learner ──────────────────────────
    { email: "lavanya@learner.test", slug: "terraform-iac", status: "RETURNED", days: 20, score: 71, text: "Module refactor with a remote backend and workspace-per-environment.", repo: "https://github.com/lkrishnan/tf-envs", feedback: "Passing, with a caveat: workspace-per-environment will bite you when the environments diverge. Read the note in the PR before you use this pattern at work.", graderEmail: "nikhil@cloudforge.test" },

    // ── Drafts (learner hasn't submitted yet) ──────────────────────────
    { email: "siddharth@learner.test", slug: "python-data-analysis", status: "DRAFT", days: 0, text: "Started on the cleaning notebook — still working through the duplicate handling." },
    { email: "neha@learner.test", slug: "product-management-tech", status: "DRAFT", days: 0, text: "Discovery interview notes so far. Two more interviews scheduled." },
  ];

  let submissionCount = 0;
  for (const s of SUBMISSIONS) {
    if (await ensureSubmission(s)) submissionCount++;
  }
  // A resubmission that landed on top of a rejected first attempt.
  await ensureSubmission({ email: "devansh@learner.test", slug: "flutter-production", status: "SUBMITTED", days: 1, attemptNo: 2, text: "Second attempt: migrated everything to Riverpod and wrote the rationale in STATE.md as asked.", repo: "https://github.com/devansht/flutter-inventory" });
  await ensureSubmission({ email: "varun@learner.test", slug: "unit-testing-tdd", status: "GRADED", days: 2, attemptNo: 2, score: 83, text: "Rewrote the six weak tests around observable behaviour. Coverage dropped to 84% and the suite is much more useful.", repo: "https://github.com/varunp/cart-tests", feedback: "Much better. Dropping coverage to raise signal was the right call and you explained why.", graderEmail: "gaurav@codecraft.test" });

  const pendingQueue = await db.assignmentSubmission.count({ where: { status: { in: ["SUBMITTED", "RESUBMIT_REQUESTED", "GRADING"] } } });
  const submissionSpread = await db.assignmentSubmission.groupBy({ by: ["status"], _count: { _all: true } });

  // Quiz attempts — passes, fails, and a retake that turns into a pass.
  const ensureQuizAttempt = async (
    email: string,
    courseSlug: string,
    attemptNo: number,
    correctCount: number,
    daysAgoTaken: number,
  ) => {
    const entry = catalog[courseSlug];
    if (!entry || entry.kind !== "COURSE") return null;
    const uid = userIdFor(email);
    if (!uid) return null;
    const quiz = await db.quiz.findFirst({
      where: { lesson: { courseId: entry.id } },
      include: { questions: { orderBy: { position: "asc" } } },
    });
    if (!quiz || quiz.questions.length === 0) return null;
    const existing = await db.quizAttempt.findUnique({
      where: { quizId_userId_attemptNo: { quizId: quiz.id, userId: uid, attemptNo } },
    });
    if (existing) return existing;
    const enrollment = await enrollmentFor(uid, courseSlug, 40);

    // Answer the highest-value questions first, so `correctCount` maps onto a
    // predictable pass/fail ladder regardless of how the quiz is weighted.
    const rightIds = new Set(
      [...quiz.questions]
        .sort((a, b) => b.points - a.points)
        .slice(0, correctCount)
        .map((q) => q.id),
    );
    const answers: Record<string, number | number[] | string> = {};
    let scorePoints = 0;
    let maxPoints = 0;
    quiz.questions.forEach((q) => {
      maxPoints += q.points;
      const correct = q.correct as { index?: number; indexes?: number[]; text?: string };
      const choices = (q.options as { choices?: string[] } | null)?.choices ?? ["a", "b"];
      const right = rightIds.has(q.id);
      if (q.type === "MULTI_CHOICE") {
        answers[q.id] = right ? (correct.indexes ?? []) : [0];
      } else {
        const ci = correct.index ?? 0;
        answers[q.id] = right ? ci : (ci + 1) % Math.max(2, choices.length);
      }
      if (right) scorePoints += q.points;
    });
    const passed = maxPoints > 0 && (scorePoints / maxPoints) * 100 >= quiz.passPct;
    return db.quizAttempt.create({
      data: {
        quizId: quiz.id,
        userId: uid,
        enrollmentId: enrollment?.id ?? null,
        attemptNo,
        seed: (attemptNo * 7919 + courseSlug.length * 31) % 100000,
        startedAt: daysAgo(daysAgoTaken),
        submittedAt: new Date(daysAgo(daysAgoTaken).getTime() + 8 * 60_000),
        gradedAt: new Date(daysAgo(daysAgoTaken).getTime() + 8 * 60_000),
        answers,
        scorePoints,
        maxPoints,
        passed,
      },
    });
  };

  const QUIZ_ATTEMPTS: Array<[string, string, number, number, number]> = [
    // [email, courseSlug, attemptNo, correctAnswers (of 3), daysAgo]
    ["ananya@learner.test", "system-design-interview", 1, 3, 12],
    ["ananya@learner.test", "advanced-react-patterns", 1, 2, 9],
    ["vikram@learner.test", "docker-kubernetes", 1, 3, 15],
    ["isha@learner.test", "typescript-deep-dive", 1, 3, 22],
    ["rohit@learner.test", "docker-kubernetes", 1, 1, 20], // failed
    ["rohit@learner.test", "docker-kubernetes", 2, 3, 18], // retake → pass
    ["sana@learner.test", "python-data-analysis", 1, 3, 11],
    ["sana@learner.test", "llm-engineering", 1, 2, 5],
    ["diya@learner.test", "ml-foundations", 1, 2, 14],
    ["karan@learner.test", "ethical-hacking", 1, 1, 16], // failed
    ["karan@learner.test", "ethical-hacking", 2, 2, 13],
    ["nikita@learner.test", "distributed-systems-fundamentals", 1, 3, 6],
    ["aryan@learner.test", "sql-mastery", 1, 3, 19],
    ["tanvi@learner.test", "ci-cd-github-actions", 1, 2, 10],
    ["farhan@learner.test", "react-native-zero", 1, 0, 25], // failed badly
    ["farhan@learner.test", "react-native-zero", 2, 1, 24], // failed again
    ["farhan@learner.test", "react-native-zero", 3, 2, 23], // passed on the last allowed attempt
    ["meghna@learner.test", "advanced-react-patterns", 1, 3, 4],
    ["abhishek@learner.test", "node-microservices", 1, 2, 7],
    ["lavanya@learner.test", "aws-solutions-architect", 1, 3, 3],
    ["ritika@learner.test", "sre-observability", 1, 2, 8],
    ["joel@learner.test", "terraform-iac", 1, 1, 12], // failed
    ["kavya@learner.test", "golang-for-backend", 1, 3, 5],
    ["yusuf@learner.test", "web-app-security", 1, 2, 4],
    ["pallavi@learner.test", "playwright-e2e", 1, 3, 9],
    ["gagan@learner.test", "android-kotlin-jetpack", 1, 2, 6],
    ["shalini@learner.test", "flutter-production", 1, 1, 17], // failed
    ["devansh@learner.test", "flutter-production", 1, 2, 10],
    ["imran@learner.test", "low-level-design-india", 1, 1, 21], // failed
    ["hemant@learner.test", "python-mastery", 1, 3, 7],
    ["pooja@learner.test", "secure-coding-appsec", 1, 2, 18],
    ["arjun", "docker-kubernetes", 1, 3, 2],
    ["arjun", "fullstack-nextjs", 1, 2, 1],
  ];
  let attemptCount = 0;
  for (const [email, slug, attemptNo, correct, days] of QUIZ_ATTEMPTS) {
    if (await ensureQuizAttempt(email, slug, attemptNo, correct, days)) attemptCount++;
  }
  const passedAttempts = await db.quizAttempt.count({ where: { passed: true } });
  const failedAttempts = await db.quizAttempt.count({ where: { passed: false } });

  console.log(
    `  ✓ Assessment: ${submissionCount + 2} assignment submissions (` +
      submissionSpread.map((s) => `${s._count._all} ${s.status}`).join(", ") +
      `) — ${pendingQueue} awaiting a grader; ${attemptCount} quiz attempts (${passedAttempts} passed / ${failedAttempts} failed)`,
  );

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

  // ── Depth: the same lifecycle across the wider project catalog ───────
  /** Spreads a target percentage across a project's weighted criteria. */
  const scoreRubricFor = async (reviewId: string, projectId: string, targetPct: number) => {
    const project = await db.project.findUnique({ where: { id: projectId }, select: { rubricId: true } });
    if (!project) return;
    const criteria = await db.rubricCriterion.findMany({
      where: { rubricId: project.rubricId },
      orderBy: { position: "asc" },
    });
    const jitter = [5, -7, 3, -4];
    for (const [i, cr] of criteria.entries()) {
      const pct = Math.min(100, Math.max(25, targetPct + jitter[i % jitter.length]));
      await db.rubricScore.upsert({
        where: { projectReviewId_rubricCriterionId: { projectReviewId: reviewId, rubricCriterionId: cr.id } },
        update: {},
        create: {
          projectReviewId: reviewId,
          rubricCriterionId: cr.id,
          score: Math.round((cr.weightPct * pct) / 10) / 10,
          maxScore: cr.weightPct,
          comment:
            pct >= 85
              ? "Strong — the reasoning holds up under questioning."
              : pct >= 65
                ? "Solid work; a couple of decisions need a clearer justification."
                : "Below the bar here — see the summary for what to change.",
        },
      });
    }
  };

  const MENTORS = {
    rithvik: { profileId: mpRithvik.id, userId: mentorRithvik.id, level: "SENIOR" as const },
    lakshmi: { profileId: mpLakshmi.id, userId: mentorLakshmi.id, level: "PRINCIPAL" as const },
    aditya: { profileId: mpAditya.id, userId: mentorAditya.id, level: "ASSOCIATE" as const },
    priyanka: { profileId: mpPriyanka.id, userId: mentorPriyanka.id, level: "PRINCIPAL" as const },
    harish: { profileId: mpHarish.id, userId: mentorHarish.id, level: "SENIOR" as const },
    fatima: { profileId: mpFatima.id, userId: mentorFatima.id, level: "SENIOR" as const },
    suresh: { profileId: mpSuresh.id, userId: mentorSuresh.id, level: "PRINCIPAL" as const },
    ankita: { profileId: mpAnkita.id, userId: mentorAnkita.id, level: "ASSOCIATE" as const },
    joseph: { profileId: mpJoseph.id, userId: mentorJoseph.id, level: "ASSOCIATE" as const },
  };

  type InstanceSpec = {
    email: string;
    slug: string;
    status: "PENDING_KICKOFF" | "IN_PROGRESS" | "IN_REVIEW" | "CHANGES_REQUESTED" | "DEFENSE_PENDING" | "PASSED" | "FAILED";
    mentor: keyof typeof MENTORS;
    started: number;
    score?: number;
  };

  const INSTANCES: InstanceSpec[] = [
    { email: "meghna@learner.test", slug: "k8s-operator-capstone", status: "PASSED", mentor: "harish", started: 62, score: 91 },
    { email: "abhishek@learner.test", slug: "url-shortener-sprint", status: "PASSED", mentor: "aditya", started: 26, score: 84 },
    { email: "kavya@learner.test", slug: "deploy-pipeline-sprint", status: "PASSED", mentor: "harish", started: 30, score: 88 },
    { email: "yusuf@learner.test", slug: "appsec-audit-sprint", status: "PASSED", mentor: "fatima", started: 24, score: 93 },
    { email: "ritika@learner.test", slug: "llm-rag-sprint", status: "PASSED", mentor: "priyanka", started: 28, score: 79 },
    { email: "nikita@learner.test", slug: "search-platform-flagship", status: "DEFENSE_PENDING", mentor: "suresh", started: 78 },
    { email: "lavanya@learner.test", slug: "url-shortener-sprint", status: "IN_REVIEW", mentor: "aditya", started: 16 },
    { email: "joel@learner.test", slug: "observability-sprint", status: "IN_REVIEW", mentor: "harish", started: 19 },
    { email: "pallavi@learner.test", slug: "test-harness-sprint", status: "IN_REVIEW", mentor: "joseph", started: 14 },
    { email: "shalini@learner.test", slug: "offline-first-field-app", status: "IN_PROGRESS", mentor: "ankita", started: 22 },
    { email: "gagan@learner.test", slug: "mobile-payments-sprint", status: "IN_PROGRESS", mentor: "ankita", started: 11 },
    { email: "sana@learner.test", slug: "llm-rag-sprint", status: "IN_PROGRESS", mentor: "priyanka", started: 9 },
    { email: "diya@learner.test", slug: "feature-store-capstone", status: "IN_PROGRESS", mentor: "priyanka", started: 34 },
    { email: "karan@learner.test", slug: "zero-trust-gateway-capstone", status: "IN_PROGRESS", mentor: "fatima", started: 27 },
    { email: "aryan@learner.test", slug: "realtime-chat-sprint", status: "CHANGES_REQUESTED", mentor: "rithvik", started: 20 },
    { email: "imran@learner.test", slug: "design-system-sprint", status: "CHANGES_REQUESTED", mentor: "ankita", started: 25 },
    { email: "devansh@learner.test", slug: "mobile-payments-sprint", status: "CHANGES_REQUESTED", mentor: "ankita", started: 31 },
    { email: "tanvi@learner.test", slug: "ml-recommender", status: "FAILED", mentor: "priyanka", started: 70, score: 46 },
    { email: "hemant@learner.test", slug: "test-harness-sprint", status: "PENDING_KICKOFF", mentor: "joseph", started: 2 },
    { email: "anushka@learner.test", slug: "design-system-sprint", status: "PENDING_KICKOFF", mentor: "ankita", started: 1 },
    { email: "pooja@learner.test", slug: "fraud-detection-capstone", status: "IN_PROGRESS", mentor: "priyanka", started: 18 },
    { email: "farhan@learner.test", slug: "checkout-service", status: "IN_PROGRESS", mentor: "aditya", started: 13 },
    { email: "manish@learner.test", slug: "exchange-core-flagship", status: "IN_PROGRESS", mentor: "suresh", started: 41 },
    { email: "nikita@learner.test", slug: "siem-detection-sprint", status: "PASSED", mentor: "fatima", started: 33, score: 87 },
    { email: "siddharth@learner.test", slug: "load-test-sprint", status: "IN_REVIEW", mentor: "joseph", started: 12 },
    { email: "neha@learner.test", slug: "onboarding-redesign-sprint", status: "IN_PROGRESS", mentor: "ankita", started: 8 },
    { email: "varun@learner.test", slug: "contract-testing-sprint", status: "PENDING_KICKOFF", mentor: "joseph", started: 3 },
    { email: "kavya@learner.test", slug: "push-notifications-sprint", status: "CHANGES_REQUESTED", mentor: "ankita", started: 17 },
  ];

  for (const spec of INSTANCES) {
    const m = MENTORS[spec.mentor];
    const inst = await ensureInstance(spec.email, spec.slug, spec.status, m.profileId, m.level, {
      started: spec.started,
      kickoff: spec.status === "PENDING_KICKOFF" ? undefined : spec.started,
      finalScore: spec.status === "PASSED" || spec.status === "FAILED" ? spec.score : undefined,
    });
    if (!inst) continue;
    const ms = await milestonesFor(catalog[spec.slug].id);
    if (ms.length === 0) continue;
    const last = ms.length - 1;

    switch (spec.status) {
      case "PENDING_KICKOFF":
        break;
      case "IN_PROGRESS": {
        const sub0 = await submitMilestone(inst.id, ms[0].id, "APPROVED", Math.max(2, spec.started - 7));
        await addReview(inst.id, sub0.id, "MENTOR_CHECKPOINT", m.userId, "COMPLETED", "APPROVED", 82, 5);
        if (ms[1]) await submitMilestone(inst.id, ms[1].id, "SUBMITTED", 2);
        break;
      }
      case "IN_REVIEW": {
        for (let i = 0; i < last; i++) {
          const s = await submitMilestone(inst.id, ms[i].id, "APPROVED", Math.max(3, spec.started - 4 * (i + 1)));
          await addReview(inst.id, s.id, "MENTOR_CHECKPOINT", m.userId, "COMPLETED", "APPROVED", 80 + i, 4);
        }
        const lastSub = await submitMilestone(inst.id, ms[last].id, "IN_REVIEW", 2);
        await addReview(inst.id, lastSub.id, "AI_FIRST_PASS", null, "COMPLETED", "APPROVED", 76, 1);
        await addReview(inst.id, lastSub.id, "MENTOR_FINAL", m.userId, "PENDING", null, null, 0);
        break;
      }
      case "CHANGES_REQUESTED": {
        const sub0 = await submitMilestone(inst.id, ms[0].id, "APPROVED", spec.started - 5);
        await addReview(inst.id, sub0.id, "MENTOR_CHECKPOINT", m.userId, "COMPLETED", "APPROVED", 78, 6);
        const target = ms[1] ?? ms[0];
        const sub1 = await submitMilestone(inst.id, target.id, "CHANGES_REQUESTED", 4);
        const rev = await addReview(inst.id, sub1.id, "MENTOR_CHECKPOINT", m.userId, "COMPLETED", "CHANGES_REQUESTED", 57, 2);
        if (rev && sub1.id !== sub0.id) await scoreRubricFor(rev.id, catalog[spec.slug].id, 57);
        break;
      }
      case "DEFENSE_PENDING": {
        for (const [i, milestone] of ms.entries()) {
          const s = await submitMilestone(inst.id, milestone.id, "APPROVED", Math.max(3, spec.started - 12 * (i + 1)));
          if (i < last) await addReview(inst.id, s.id, "MENTOR_CHECKPOINT", m.userId, "COMPLETED", "APPROVED", 84 + i, 5);
        }
        const defenseAt = daysFromNow(4);
        if (!(await db.defenseSession.findFirst({ where: { projectInstanceId: inst.id } }))) {
          await db.defenseSession.create({
            data: {
              projectInstanceId: inst.id,
              scheduledAt: defenseAt,
              status: "SCHEDULED",
              aiQuestionPlan: { themes: ["tenancy isolation", "reindex without downtime", "relevance evaluation"], questionCount: 12 },
            },
          });
        }
        await ensureLive(`seed-defense-${inst.id.slice(-8)}`, catalog[spec.slug].tenantId, m.userId, "DEFENSE", "Flagship defense: multi-tenant search platform", defenseAt, 90, { projectInstanceId: inst.id });
        break;
      }
      case "PASSED":
      case "FAILED": {
        for (const [i, milestone] of ms.entries()) {
          await submitMilestone(inst.id, milestone.id, spec.status === "PASSED" ? "APPROVED" : "CHANGES_REQUESTED", Math.max(2, spec.started - 6 * (i + 1)));
        }
        const lastSub = await db.milestoneSubmission.findFirst({ where: { projectInstanceId: inst.id }, orderBy: { submittedAt: "desc" } });
        const finalReview = await addReview(
          inst.id,
          lastSub?.id ?? null,
          "MENTOR_FINAL",
          m.userId,
          "COMPLETED",
          spec.status === "PASSED" ? "PASS" : "FAIL",
          spec.score ?? 80,
          3,
        );
        if (finalReview) await scoreRubricFor(finalReview.id, catalog[spec.slug].id, spec.score ?? 80);
        break;
      }
    }
  }

  const instanceSpread = await db.projectInstance.groupBy({ by: ["status"], _count: { _all: true } });
  const msSubs = await db.milestoneSubmission.count();
  const projReviews = await db.projectReview.count();
  const rubricScores = await db.rubricScore.count();
  const mentorAssignments = await db.mentorAssignment.count();
  console.log(
    `  ✓ Project instances: ${instanceSpread.map((s) => `${s._count._all} ${s.status}`).join(", ")} ` +
      `— ${msSubs} milestone submissions, ${projReviews} reviews, ${rubricScores} rubric scores, ${mentorAssignments} mentor assignments`,
  );

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

  // ── More course credentials (spread across tenants and grades) ───────
  const MORE_COURSE_CREDENTIALS: Array<[string, string, string, string, boolean?]> = [
    ["aryan@learner.test", "sql-mastery", "AC-ARY-SQL-8H2N", "Distinction"],
    ["diya@learner.test", "ml-foundations", "AC-DIY-ML-4B7Z", "Merit"],
    ["rohit@learner.test", "docker-kubernetes", "AC-ROH-DK8-1F9C", "Merit"],
    ["tanvi@learner.test", "ci-cd-github-actions", "AC-TAN-CI-6D3V", "Merit"],
    ["meghna@learner.test", "advanced-react-patterns", "AC-MEG-RCT-2W8L", "Distinction"],
    ["lavanya@learner.test", "aws-solutions-architect", "AC-LAV-AWS-9J4Q", "Distinction"],
    ["kavya@learner.test", "golang-for-backend", "AC-KAV-GO-3T6Y", "Distinction"],
    ["yusuf@learner.test", "web-app-security", "AC-YUS-SEC-7P1M", "Merit"],
    ["pallavi@learner.test", "playwright-e2e", "AC-PAL-PW-5N8K", "Distinction"],
    ["gagan@learner.test", "android-kotlin-jetpack", "AC-GAG-AND-4R2X", "Merit"],
    ["hemant@learner.test", "python-mastery", "AC-HEM-PY-8C5G", "Distinction"],
    ["pooja@learner.test", "secure-coding-appsec", "AC-POO-SC-1V7B", "Merit"],
    ["nikita@learner.test", "distributed-systems-fundamentals", "AC-NIK-DS-6Z3H", "Distinction"],
    ["abhishek@learner.test", "node-microservices", "AC-ABH-NMS-2Q9F", "Merit"],
    ["ritika@learner.test", "sre-observability", "AC-RIT-SRE-7L4D", "Distinction"],
    // Revoked: issued against an attempt later found to be plagiarised.
    ["varun@learner.test", "react-native-zero", "AC-VAR-RN-0M6S", "Pass", true],
  ];
  for (const [email, slug, code, grade, revoked] of MORE_COURSE_CREDENTIALS) {
    const uid = learnerUsers[email]?.id;
    if (!uid) continue;
    // A credential implies a completed enrollment — make that true.
    await ensureEnrollment(uid, slug, 100, "PURCHASE", daysAgo(5));
    await ensureCourseCredential(uid, slug, code, grade, revoked ?? false);
  }

  // ── Project credentials for every PASSED instance ────────────────────
  const PROJECT_CREDENTIALS: Array<[string, string, string, string]> = [
    ["meghna@learner.test", "k8s-operator-capstone", "PJ-MEG-K8S-5X2R", "Distinction"],
    ["abhishek@learner.test", "url-shortener-sprint", "PJ-ABH-URL-9G7T", "Merit"],
    ["kavya@learner.test", "deploy-pipeline-sprint", "PJ-KAV-CD-3H8W", "Distinction"],
    ["yusuf@learner.test", "appsec-audit-sprint", "PJ-YUS-AUD-6K1P", "Distinction"],
    ["ritika@learner.test", "llm-rag-sprint", "PJ-RIT-RAG-4Y9N", "Merit"],
    ["nikita@learner.test", "siem-detection-sprint", "PJ-NIK-SIEM-8D3C", "Distinction"],
  ];
  for (const [email, slug, code, grade] of PROJECT_CREDENTIALS) {
    const uid = learnerUsers[email]?.id;
    const entry = catalog[slug];
    if (!uid || !entry) continue;
    const inst = await db.projectInstance.findFirst({ where: { userId: uid, projectId: entry.id, status: "PASSED" } });
    if (inst) await ensureProjectCredential(uid, inst.id, entry.title, code, grade);
  }

  console.log(
    `  ✓ Credentials: ${MORE_COURSE_CREDENTIALS.length + 5} course (2 revoked) + ${PROJECT_CREDENTIALS.length + 1} project — program certificates follow with the enterprise data`,
  );

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

  // ── A fuller Nalanda cohort: 8 more students across the progress curve ─
  const NALANDA_INTAKE: Array<[string, string, number]> = [
    ["tejas@nalanda.test", "Tejas Deshmukh", 100],
    ["sanjana@nalanda.test", "Sanjana Pillai", 100],
    ["harsh@nalanda.test", "Harsh Vardhan", 92],
    ["nidhi@nalanda.test", "Nidhi Choudhary", 74],
    ["arnav@nalanda.test", "Arnav Bhattacharya", 55],
    ["prerna@nalanda.test", "Prerna Joshi", 41],
    ["vivaan@nalanda.test", "Vivaan Shetty", 22],
    ["ayesha@nalanda.test", "Ayesha Siddiqui", 8],
  ];
  const nalandaCompleted: Array<{ userId: string; peId: string; name: string }> = [];
  for (const [email, name, progress] of NALANDA_INTAKE) {
    const u = await ensureUser(email, name);
    await ensureMember(nalandaOrg.id, u.id, "member");
    const pe = await enrollProgramStudent(u.id, progress);
    if (progress >= 100) nalandaCompleted.push({ userId: u.id, peId: pe.id, name });
  }
  // Program certificates for the two who finished.
  const nalandaTenant = await db.tenant.findUniqueOrThrow({ where: { slug: "nalanda" } });
  const nalandaTemplate = await db.certificateTemplate.findFirst({
    where: { tenantId: nalandaTenant.id, kind: "PROGRAM" },
  });
  const programCodes: Array<[string, string]> = [
    [nalandaCompleted[0]?.peId ?? "", "NX9P-2KTM-R7WD"],
    [nalandaCompleted[1]?.peId ?? "", "NX4B-8HLQ-Z3VG"],
  ];
  for (const [idx, [peId, code]] of programCodes.entries()) {
    const holder = nalandaCompleted[idx];
    if (!peId || !holder) continue;
    if (await db.credential.findFirst({ where: { verificationCode: code } })) continue;
    await db.projectInstance.updateMany({
      where: { userId: holder.userId, programEnrollmentId: peId },
      data: { status: "PASSED", completedAt: daysAgo(4), finalScore: 84 + idx * 5 },
    });
    await db.credential.create({
      data: {
        userId: holder.userId,
        kind: "PROGRAM",
        programEnrollmentId: peId,
        templateId: nalandaTemplate?.id ?? null,
        title: nalandaProgram.title,
        grade: idx === 0 ? "Distinction" : "Merit",
        verificationCode: code,
        issuedAt: daysAgo(3),
        metadata: { coBrandPartner: "Nalanda University", cohort: "2026 Cohort A" },
      },
    });
  }

  // ── Acme: more seats, more pool usage, a project drawn from the pool ──
  const ACME_INTAKE: Array<[string, string, "ACTIVATED" | "INVITED"]> = [
    ["nandini@acme.test", "Nandini Reddy", "ACTIVATED"],
    ["siddhant@acme.test", "Siddhant Kaul", "ACTIVATED"],
    ["farida@acme.test", "Farida Merchant", "ACTIVATED"],
    ["omkar@acme.test", "Omkar Jadhav", "INVITED"],
  ];
  const acmeIntakeUsers: Array<{ id: string; status: string }> = [];
  for (const [email, name, status] of ACME_INTAKE) {
    const u = await ensureUser(email, name);
    await ensureMember(acmeOrg.id, u.id, "member");
    await ensureSeat(acmeCatalog.id, u.id, null, status);
    acmeIntakeUsers.push({ id: u.id, status });
  }
  await ensureSeat(acmeCatalog.id, null, "prospect1@acme.test", "INVITED");
  await ensureSeat(acmeCatalog.id, null, "prospect2@acme.test", "INVITED");

  await consumePool(acmeIntakeUsers[0].id, "aws-solutions-architect");
  await consumePool(acmeIntakeUsers[1].id, "terraform-iac");
  await consumePool(acmeIntakeUsers[2].id, "system-design-interview");
  await consumePool(sneha.id, "sre-observability");

  // A pool-funded project run (exercises LicenseConsumption for PROJECT).
  const poolProject = catalog["deploy-pipeline-sprint"];
  if (poolProject) {
    const existing = await db.licenseConsumption.findFirst({
      where: { licenseId: acmePool.id, userId: acmeIntakeUsers[0].id, projectId: poolProject.id },
    });
    if (!existing) {
      const price = await db.price.findFirst({ where: { projectId: poolProject.id, currency: INR, region: null, mentorLevel: null } });
      const instance = await db.projectInstance.create({
        data: {
          projectId: poolProject.id,
          userId: acmeIntakeUsers[0].id,
          source: "ORG_LICENSE",
          status: "IN_PROGRESS",
          startedAt: daysAgo(12),
          mentorKickoffAt: daysAgo(12),
          dueAt: daysFromNow(9),
        },
      });
      await db.mentorAssignment.create({ data: { projectInstanceId: instance.id, mentorProfileId: mpHarish.id, role: "PRIMARY", assignedAt: daysAgo(12) } });
      await db.licenseConsumption.create({
        data: {
          licenseId: acmePool.id,
          userId: acmeIntakeUsers[0].id,
          itemType: "PROJECT",
          projectId: poolProject.id,
          amountMinor: price?.amountMinor ?? paise(6499),
          projectInstanceId: instance.id,
        },
      });
    }
  }

  const seatSpread = await db.licenseSeat.groupBy({ by: ["status"], _count: { _all: true } });
  const consumptions = await db.licenseConsumption.aggregate({ _count: { _all: true }, _sum: { amountMinor: true } });
  const programEnrollmentCount = await db.programEnrollment.count();
  console.log(
    `  ✓ Enterprise depth: ${programEnrollmentCount} program enrollments, seats (${seatSpread.map((s) => `${s._count._all} ${s.status}`).join(", ")}), ` +
      `${consumptions._count._all} credit-pool consumptions worth ₹${Number((consumptions._sum.amountMinor ?? 0n) / 100n).toLocaleString("en-IN")}`,
  );

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
  await ensurePortfolio(learnerUsers["meghna@learner.test"].id, "meghna-sarkar", "Platform engineer • Kubernetes & Go", "PUBLIC");
  await ensurePortfolio(learnerUsers["yusuf@learner.test"].id, "yusuf-ansari", "Application security engineer", "PUBLIC");
  await ensurePortfolio(learnerUsers["ritika@learner.test"].id, "ritika-agarwal", "SRE • reliability and observability", "PUBLIC");
  await ensurePortfolio(learnerUsers["kavya@learner.test"].id, "kavya-subramanian", "Backend engineer • Go and distributed systems", "UNLISTED");

  // ─────────────────────────────────────────────────────────────────────
  // LessonProgress backfill — makes "continue where you left off" real
  //
  // Derived from Enrollment.progressPct so the two never disagree: the first
  // ceil(pct% × lessons) lessons are COMPLETED, the next one IN_PROGRESS.
  // ─────────────────────────────────────────────────────────────────────
  const lessonsByCourse = new Map<string, Array<{ id: string; durationSec: number | null }>>();
  const allLessons = await db.lesson.findMany({
    orderBy: [{ courseId: "asc" }, { position: "asc" }],
    select: { id: true, courseId: true, durationSec: true },
  });
  for (const l of allLessons) {
    const list = lessonsByCourse.get(l.courseId) ?? [];
    list.push({ id: l.id, durationSec: l.durationSec });
    lessonsByCourse.set(l.courseId, list);
  }

  const allEnrollments = await db.enrollment.findMany({
    select: { id: true, courseId: true, progressPct: true, lastActivityAt: true },
  });
  const progressRows: Prisma.LessonProgressCreateManyInput[] = [];
  for (const e of allEnrollments) {
    const lessons = lessonsByCourse.get(e.courseId);
    if (!lessons || lessons.length === 0) continue;
    const done = Math.min(lessons.length, Math.round((e.progressPct / 100) * lessons.length));
    for (let i = 0; i < done; i++) {
      progressRows.push({
        enrollmentId: e.id,
        lessonId: lessons[i].id,
        status: "COMPLETED",
        secondsWatched: lessons[i].durationSec ?? 240,
        lastPositionSec: lessons[i].durationSec ?? 240,
        completedAt: e.lastActivityAt ?? daysAgo(7),
      });
    }
    // The lesson they're mid-way through — the resume point.
    if (done < lessons.length && e.progressPct > 0) {
      const partial = lessons[done];
      const half = Math.round((partial.durationSec ?? 240) / 2);
      progressRows.push({
        enrollmentId: e.id,
        lessonId: partial.id,
        status: "IN_PROGRESS",
        secondsWatched: half,
        lastPositionSec: half,
      });
    }
  }
  // createMany + skipDuplicates keeps this safe to re-run.
  let progressWritten = 0;
  for (let i = 0; i < progressRows.length; i += 500) {
    const res = await db.lessonProgress.createMany({ data: progressRows.slice(i, i + 500), skipDuplicates: true });
    progressWritten += res.count;
  }
  console.log(
    `  ✓ Lesson progress: ${progressWritten} rows written (${progressRows.length} derived from ${allEnrollments.length} enrollments)`,
  );

  // ─────────────────────────────────────────────────────────────────────
  // Paste-ready verification codes for /verify
  // ─────────────────────────────────────────────────────────────────────
  const credentialSpread = await db.credential.groupBy({ by: ["kind"], _count: { _all: true } });
  const revokedCount = await db.credential.count({ where: { revokedAt: { not: null } } });
  console.log(
    `  ✓ Credentials (final): ${credentialSpread.map((c) => `${c._count._all} ${c.kind}`).join(", ")} — ${revokedCount} revoked, all codes unique`,
  );

  // One live example of each kind, plus a revoked one, so the verify page can
  // be exercised in every state straight after a seed run.
  const samples: Array<{ verificationCode: string; kind: string; title: string }> = [];
  for (const kind of ["PROJECT", "PROGRAM", "COURSE"] as const) {
    const found = await db.credential.findMany({
      where: { kind, revokedAt: null },
      orderBy: { issuedAt: "desc" },
      take: 2,
      select: { verificationCode: true, kind: true, title: true },
    });
    samples.push(...found);
  }
  const revokedSample = await db.credential.findFirst({
    where: { revokedAt: { not: null } },
    select: { verificationCode: true, title: true },
  });
  console.log("  ─ Paste into /verify (or open /verify/<code>):");
  for (const c of samples) {
    console.log(`      ${c.verificationCode}   ${c.kind.padEnd(7)} ${c.title}`);
  }
  if (revokedSample) {
    console.log(`      ${revokedSample.verificationCode}   REVOKED ${revokedSample.title}`);
  }

  console.log("✓ Complex mock data enrichment complete.");
}
