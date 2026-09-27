import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit configuration: `pnpm db:generate` diffs `src/schema` into `migrations/`.
 *
 * drizzle-kit 配置：`pnpm db:generate` 对比 `src/schema` 生成迁移到 `migrations/`，生成后需人工审阅。
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  casing: "snake_case",
  strict: true,
  verbose: true,
  dbCredentials: {
    // Only used by interactive drizzle-kit commands (e.g. studio); migrations run via src/scripts/migrate.ts.
    url: process.env.DATABASE_URL ?? "postgres://qic:qic@localhost:15432/qic",
  },
});
