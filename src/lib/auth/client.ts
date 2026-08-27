"use client";

import { ssoClient } from "@better-auth/sso/client";
import {
  adminClient,
  inferAdditionalFields,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import type { Auth } from "@/lib/auth";
import { ac, orgRoles } from "@/lib/auth/permissions";

export const authClient = createAuthClient({
  plugins: [
    // Type-only import of the server instance — erased at build, so no server
    // code reaches the bundle. Without it, `user.additionalFields` (phone,
    // timezone, locale, marketingOptIn) are invisible to signUp/updateUser.
    inferAdditionalFields<Auth>(),
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
