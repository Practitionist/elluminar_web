import "dotenv/config";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Creates login-able demo accounts (one per role) with a shared password and
 * verified emails, wiring org memberships so each lands on a populated
 * dashboard. Idempotent — safe to re-run. Run: pnpm tsx prisma/seed-demo-users.ts
 */
const PASSWORD = "DemoPass123!";

type Demo = {
  email: string;
  name: string;
  role: "user" | "admin";
  membership?: { tenantSlug: string; role: string };
  blurb: string;
};

const DEMO: Demo[] = [
  {
    email: "arjun@acme.test",
    name: "Arjun Rao",
    role: "user",
    blurb: "Learner (has an enrollment + credential)",
  },
  {
    email: "creator@demo.test",
    name: "Cora Creator",
    role: "user",
    membership: { tenantSlug: "demo-academy", role: "owner" },
    blurb: "Creator / teacher — owns Demo Academy studio",
  },
  {
    email: "orgadmin@demo.test",
    name: "Omar Admin",
    role: "user",
    membership: { tenantSlug: "acme", role: "owner" },
    blurb: "Enterprise admin — Acme Corp org portal",
  },
  {
    email: "admin@demo.test",
    name: "Ada Admin",
    role: "admin",
    blurb: "Platform admin — full /admin access",
  },
];

async function main() {
  const ctx = await auth.$context;
  const hashed = await ctx.password.hash(PASSWORD);

  for (const d of DEMO) {
    const user = await db.user.upsert({
      where: { email: d.email },
      update: { name: d.name, role: d.role, emailVerified: true },
      create: {
        email: d.email,
        name: d.name,
        role: d.role,
        emailVerified: true,
      },
    });

    const existing = await db.account.findFirst({
      where: { userId: user.id, providerId: "credential" },
      select: { id: true },
    });
    if (existing) {
      await db.account.update({
        where: { id: existing.id },
        data: { password: hashed },
      });
    } else {
      await db.account.create({
        data: {
          accountId: user.id,
          providerId: "credential",
          userId: user.id,
          password: hashed,
        },
      });
    }

    if (d.membership) {
      const tenant = await db.tenant.findUnique({
        where: { slug: d.membership.tenantSlug },
        select: { organizationId: true },
      });
      if (tenant) {
        await db.member.upsert({
          where: {
            organizationId_userId: {
              organizationId: tenant.organizationId,
              userId: user.id,
            },
          },
          update: { role: d.membership.role },
          create: {
            organizationId: tenant.organizationId,
            userId: user.id,
            role: d.membership.role,
          },
        });
      }
    }
  }

  console.log("\n  Demo accounts (password for all): " + PASSWORD + "\n");
  for (const d of DEMO) {
    console.log(`  • ${d.email.padEnd(22)} ${d.blurb}`);
  }
  console.log(
    "\n  Set DEV_DISABLE_AUTH=false in .env and restart to log in as these.\n",
  );

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
