import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { sso } from "@better-auth/sso";
import { admin, organization, twoFactor } from "better-auth/plugins";

import { env } from "@/env";
import { db } from "@/lib/db";
import { ac, orgRoles } from "@/lib/auth/permissions";
import { hasOrgRole } from "@/lib/auth/roles";
import { createAuthSecondaryStorage } from "@/lib/auth/secondary-storage";
import { sendAuthEmail } from "@/lib/email";
import {
  ChangeEmailConfirmation,
  OrganizationInvitation,
  ResetPasswordEmail,
  VerifyEmail,
} from "@/lib/email/templates/auth-emails";

/**
 * Origins allowed to drive the auth API. BetterAuth always trusts `baseURL`;
 * these are the extras. Netlify injects DEPLOY_PRIME_URL/URL per deploy, so
 * previews are covered without a wildcard that would trust the whole
 * *.netlify.app namespace.
 */
const trustedOrigins = [
  process.env.DEPLOY_PRIME_URL,
  process.env.URL,
  process.env.NODE_ENV !== "production" ? "http://localhost:3000" : null,
].filter((v): v is string => Boolean(v));

export const auth = betterAuth({
  appName: "elluminar",
  baseURL: env.NEXT_PUBLIC_APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),

  trustedOrigins,

  advanced: {
    // Explicit rather than inferred from the baseURL protocol: behind
    // Netlify's proxy the origin BetterAuth sees is not always https.
    useSecureCookies: process.env.NODE_ENV === "production",
  },

  user: {
    additionalFields: {
      phone: { type: "string", required: false },
      timezone: { type: "string", required: false, defaultValue: "Asia/Kolkata" },
      locale: { type: "string", required: false, defaultValue: "en" },
      marketingOptIn: { type: "boolean", required: false, defaultValue: false },
      onboardedAt: { type: "date", required: false, input: false },
      anonymizedAt: { type: "date", required: false, input: false },
    },
    changeEmail: {
      enabled: true,
      // Sent to the CURRENT address, not the new one: if an attacker with a
      // live session changes the email, the real owner is the one who finds
      // out, and the change does not take effect until they approve it.
      sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
        await sendAuthEmail({
          to: user.email,
          subject: "Approve your new email address",
          react: ChangeEmailConfirmation({ name: user.name, newEmail, url }),
        });
      },
    },
  },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendAuthEmail({
        to: user.email,
        subject: "Reset your password",
        react: ResetPasswordEmail({ name: user.name, url }),
      });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendAuthEmail({
        to: user.email,
        subject: "Verify your email",
        react: VerifyEmail({ name: user.name, url }),
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
    // With secondaryStorage configured, better-auth defaults to storing session
    // records in it. We only want Redis for rate limiting — sessions stay in
    // Postgres so an Upstash outage/eviction can never log users out.
    storeSessionInDatabase: true,
  },

  // Same for verification values (email verification, password-reset tokens):
  // durable in Postgres, not subject to Redis TTL/eviction.
  verification: {
    storeInDatabase: true,
  },

  // Shared store for rate limiting (issue #35): Upstash Redis via
  // secondaryStorage when configured — limits hold across serverless instances.
  // Falls back to per-instance memory in local dev / pre-provisioning; escalate
  // only if credential-stuffing still shows up in Sentry.
  secondaryStorage: createAuthSecondaryStorage() ?? undefined,

  // Brute-force protection on auth endpoints (issue #35). Storage is shared
  // (secondaryStorage) when Upstash is configured; otherwise memory.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 3 },
      "/request-password-reset": { window: 300, max: 3 },
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
        // BetterAuth stores roles as a comma-separated string, so the previous
        // `where: { role: "owner" }` exact match silently ignored anyone whose
        // membership reads "owner,instructor" — letting them past the cap.
        const memberships = await db.member.findMany({
          where: { userId: user.id },
          select: { role: true },
        });
        const owned = memberships.filter((m) => hasOrgRole(m.role, ["owner"])).length;
        return owned < 3;
      },
      membershipLimit: 10000,
      invitationExpiresIn: 60 * 60 * 72,
      sendInvitationEmail: async (data) => {
        const inviteUrl = `${env.NEXT_PUBLIC_APP_URL}/accept-invitation/${data.id}`;
        await sendAuthEmail({
          to: data.email,
          subject: `You're invited to join ${data.organization.name}`,
          react: OrganizationInvitation({
            organizationName: data.organization.name,
            inviterName: data.inviter.user.name,
            url: inviteUrl,
          }),
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
        // Deliberately the floor, not a mapping of IdP groups to org roles.
        // An IdP group claim is controlled by the customer's IT team, and
        // `member` is the only role that cannot grade, publish, or spend —
        // see canGrade() in lib/auth/roles.ts. Elevation stays a deliberate
        // act inside our own members UI.
        defaultRole: "member",
      },

      // Sign-ins only match providers with domainVerified = true. Without
      // this, a provider would be usable the instant it was registered —
      // and the domain is what decides whose employees join which org.
      domainVerification: { enabled: true },

      /**
       * Runs on first SSO sign-in (and only then). Fills in the profile fields
       * the IdP already knows so the learner does not re-enter them in
       * onboarding; deliberately never touches role, email or emailVerified.
       */
      provisionUser: async ({ user, userInfo }) => {
        const claims = userInfo as Record<string, unknown>;
        const locale = typeof claims.locale === "string" ? claims.locale.slice(0, 2) : null;
        const zoneinfo = typeof claims.zoneinfo === "string" ? claims.zoneinfo : null;

        const data: { locale?: string; timezone?: string } = {};
        if (locale === "en" || locale === "hi") data.locale = locale;
        if (zoneinfo) data.timezone = zoneinfo;
        if (Object.keys(data).length === 0) return;

        // Never fatal: a failure here must not cost the user their sign-in.
        await db.user.update({ where: { id: user.id }, data }).catch((err) => {
          console.error("[sso provisionUser]", err);
        });
      },

      saml: {
        // Correlate every response to an AuthnRequest we issued. Stored in
        // secondaryStorage when Upstash is configured, else the verification
        // table — both work on serverless.
        enableInResponseToValidation: true,
        requestTTL: 5 * 60 * 1000,
        clockSkew: 2 * 60 * 1000,
        // IdP-initiated flows cannot be correlated to a request we issued, so
        // they lose replay protection. Our SP-initiated flow covers Okta,
        // Entra ID and Shibboleth; turn this on only for a customer that
        // genuinely needs a portal tile, and note it in their runbook entry.
        allowIdpInitiated: false,
        // Okta, Entra ID and OneLogin all follow SAML2Int, which requires
        // NotBefore/NotOnOrAfter. Without them an intercepted assertion is
        // valid forever.
        requireTimestamps: true,
        // SHA-1, RSA1_5 and 3DES are broken, not merely old.
        algorithms: { onDeprecated: "reject" },
      },
    }),
    twoFactor({
      issuer: "elluminar",
    }),
    // Must be last: applies Set-Cookie handling for Next.js server actions.
    nextCookies(),
  ],
});

export type Auth = typeof auth;
