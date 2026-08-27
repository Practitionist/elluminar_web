import path from "node:path";

import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    // .tsx too: the email templates are React, so their tests must be as well.
    include: ["src/**/*.test.ts?(x)", "tests/unit/**/*.test.ts?(x)"],
    env: {
      SKIP_ENV_VALIDATION: "1",
    },
  },
});
