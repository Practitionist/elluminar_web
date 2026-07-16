import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { sso } from "@better-auth/sso";
import { admin, organization, twoFactor } from "better-auth/plugins";

import { env } from "@/env";
import { db } from "@/lib/db";
import { ac, orgRoles } from "@/lib/auth/permissions";
import { sendEmail } from "@/lib/email";

export const auth = betterAuth({
  appName: "lms-web",
  baseURL: env.NEXT_PUBLIC_APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),

  user: {
    additionalFields: {
      phone: { type: "string", required: false },
      timezone: { type: "string", required: false, defaultValue: "Asia/Kolkata" },
      locale: { type: "string", required: false, defaultValue: "en" },
      marketingOptIn: { type: "boolean", required: false, defaultValue: false },
      onboardedAt: { type: "date", required: false, input: false },
      anonymizedAt: { type: "date", required: false, input: false },
    },
  },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your password",
        text: `Hi ${user.name},\n\nReset your password: ${url}\n\nIf you didn't request this, ignore this email.`,
      });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Verify your email",
        text: `Hi ${user.name},\n\nConfirm your email to activate your account: ${url}`,
      });
    },
  },

  socialProviders: {
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
  },

  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },

  // Brute-force protection on auth endpoints (issue #35). Memory storage is
  // per-instance on serverless — enough to blunt bursts; move to secondary
  // storage if credential-stuffing shows up in Sentry.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 3 },
      "/forget-password": { window: 300, max: 3 },
      "/two-factor/verify-totp": { window: 60, max: 5 },
    },
  },

  databaseHooks: {
    session: {
      create: {
        // Seat auto-match on every sign-in (email/password, OAuth, SSO):
        // claims INVITED enterprise seats for verified emails. Defensively
        // wrapped — enterprise failures must never block sign-in.
        after: async (session) => {
          try {
            const user = await db.user.findUnique({
              where: { id: session.userId },
              select: { id: true, email: true, emailVerified: true },
            });
            if (user?.emailVerified) {
              const { activateSeatsForUser } = await import("@/lib/enterprise/roster");
              await activateSeatsForUser(user.id, user.email);
            }
          } catch (err) {
            console.error("[seat auto-match]", err);
          }
        },
      },
    },
  },

  plugins: [
    organization({
      ac,
      roles: orgRoles,
      teams: { enabled: true },
      dynamicAccessControl: { enabled: true },
      // May-create check: platform admins create enterprise tenants sales-led
      // (uncapped); everyone else keeps the 3-org cap.
      organizationLimit: async (user) => {
        if ((user as { role?: string | null }).role === "admin") return true;
        const owned = await db.member.count({
          where: { userId: user.id, role: "owner" },
        });
        return owned < 3;
      },
      membershipLimit: 10000,
      invitationExpiresIn: 60 * 60 * 72,
      sendInvitationEmail: async (data) => {
        const inviteUrl = `${env.NEXT_PUBLIC_APP_URL}/accept-invitation/${data.id}`;
        await sendEmail({
          to: data.email,
          subject: `You're invited to join ${data.organization.name}`,
          text: `${data.inviter.user.name} invited you to join ${data.organization.name}.\n\nAccept: ${inviteUrl}`,
        });
      },
      organizationHooks: {
        afterCreateOrganization: async ({ organization: org }) => {
          // Every organization gets a Tenant commerce/branding profile.
          // New self-serve orgs start as creator applications (admin approves).
          await db.tenant.upsert({
            where: { organizationId: org.id },
            update: {},
            create: {
              organizationId: org.id,
              type: "CREATOR",
              status: "APPLIED",
              slug: org.slug,
              displayName: org.name,
            },
          });
        },
      },
    }),
    admin({
      defaultRole: "user",
      adminRoles: ["admin"],
    }),
    sso({
      organizationProvisioning: {
        disabled: false,
        defaultRole: "member",
      },
      // Sign-ins only match providers with domainVerified = true — the flag
      // the platform-admin trust toggle flips. Without this, unreviewed
      // providers would be usable immediately after registration.
      domainVerification: { enabled: true },
    }),
    twoFactor({
      issuer: "lms-web",
    }),
    // Must be last: applies Set-Cookie handling for Next.js server actions.
    nextCookies(),
  ],
});

export type Auth = typeof auth;
