import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3100",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3100/api/auth/ok",
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      PORT: "3100",
      NEXT_PUBLIC_APP_URL: "http://localhost:3100",
    },
  },
});
