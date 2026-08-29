// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

import { sentryEnabled, sentryEnvironment } from "./src/lib/sentry-env";

const tracesSampleRate = process.env.SENTRY_TRACES_SAMPLE_RATE
  ? Number(process.env.SENTRY_TRACES_SAMPLE_RATE)
  : process.env.NODE_ENV === "production"
    ? 0.1
    : 1;

Sentry.init({
  // No hard-coded fallback: an unset DSN must mean "do not report", not
  // "report into production". NEXT_PUBLIC_SENTRY_DSN is set on Netlify for all
  // deploy contexts.
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only real Netlify deploys report. Without this a local `pnpm dev` ships
  // every console.error into the production project — see lib/sentry-env.ts.
  enabled: sentryEnabled(),

  // production / preview / branch-deploy / development, from the Netlify deploy
  // context. NODE_ENV cannot tell a preview deploy from a production one.
  environment: sentryEnvironment(),

  // Add optional integrations for additional features
  integrations: [
    // Surface console.error calls (e.g. SSR render warnings) as Sentry events.
    Sentry.captureConsoleIntegration({ levels: ["error"] }),
  ],

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: [],
  },
});
