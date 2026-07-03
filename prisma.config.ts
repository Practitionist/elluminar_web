import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  // Multi-file schema: prisma/schema.prisma (generator + datasource) + prisma/models/*.prisma
  schema: "prisma/",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Prisma CLI (migrate/studio) uses the direct/session connection.
    // Runtime queries use the pooled DATABASE_URL via @prisma/adapter-pg (src/lib/db.ts).
    url: env("DIRECT_URL"),
  },
});
