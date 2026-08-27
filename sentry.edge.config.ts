// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
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
