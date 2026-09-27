/**
 * CLI entry of `pnpm db:migrate`: applies pending migrations to `DATABASE_URL`.
 *
 * `pnpm db:migrate` 的入口：对 `DATABASE_URL`（缺省为本地开发库）执行待应用的迁移。
 */
import { createDb } from "../client.js";
import { resolveDatabaseUrl } from "../env.js";
import { runMigrations } from "../migrate.js";

const { db, close } = createDb(resolveDatabaseUrl(), { maxConnections: 1 });
try {
  await runMigrations(db);
  process.stdout.write("Migrations applied.\n");
} finally {
  await close();
}
