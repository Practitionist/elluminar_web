import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**",
    ".netlify/**",
    // Nested agent worktrees — full checkouts of this repo, already linted on
    // their own branches. Without this, a bare `pnpm lint` at the root walks
    // into them and reports thousands of phantom errors.
    ".claude/**",
    // Designer reference drop — not app code.
    "LMS and project completion design/**",
  ]),
]);

export default eslintConfig;
