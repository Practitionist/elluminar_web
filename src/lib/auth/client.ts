"use client";

import { ssoClient } from "@better-auth/sso/client";
import {
  adminClient,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { ac, orgRoles } from "@/lib/auth/permissions";

export const authClient = createAuthClient({
  plugins: [
    organizationClient({
      ac,
      roles: orgRoles,
      teams: { enabled: true },
      dynamicAccessControl: { enabled: true },
    }),
    adminClient(),
    twoFactorClient({
      onTwoFactorRedirect() {
        window.location.href = "/two-factor";
      },
    }),
    ssoClient(),
  ],
});

export const { signIn, signUp, signOut, useSession } = authClient;
