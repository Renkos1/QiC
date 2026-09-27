import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { Database } from "./client.js";

/**
 * Absolute path of the SQL migrations; the same relative location works from `src/` and `dist/`.
 *
 * 迁移 SQL 所在目录的绝对路径；从 `src/` 或 `dist/` 运行时相对位置相同。
 */
export const MIGRATIONS_FOLDER = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../migrations",
);

/**
 * Applies pending migrations. Safe to run repeatedly: drizzle records applied
 * migrations in drizzle.__drizzle_migrations and skips them on the next run.
 *
 * 执行尚未应用的迁移。可重复运行：已应用的迁移记录在 `drizzle.__drizzle_migrations`，
 * 下次会跳过。部署时由一次性的 `migrate` 容器在 api 启动前调用。
 *
 * @param db - Target database. 目标数据库。
 */
export const runMigrations = (db: Database) => migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
