// Test-only helpers: exported as "@qic/db/testing" and never built into dist.
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { sql } from "drizzle-orm";
import { createDb, type DbHandle } from "./client.js";
import { runMigrations } from "./migrate.js";

/**
 * Same image as docker-compose.yml so tests run against the production engine version.
 *
 * 与 docker-compose.yml 相同的镜像，保证测试使用与生产一致的数据库版本。
 */
export const POSTGRES_IMAGE = "postgres:18.6-alpine";

/**
 * A migrated, throwaway database for one test file.
 *
 * 供单个测试文件使用、已迁移的一次性数据库。
 */
export interface TestDatabase extends DbHandle {
  /** Connection URL of the container. 容器的连接串。 */
  url: string;
  /** Closes the pool and removes the container. 关闭连接池并删除容器。 */
  stop: () => Promise<void>;
}

/**
 * Starts a throwaway Postgres container; migrated to the latest schema unless disabled.
 *
 * 启动一次性的 Postgres 容器，默认迁移到最新 schema。需要 Docker。
 *
 * @param options - `migrate: false` to test migrations themselves. 传 `migrate: false` 可用于测试迁移本身。
 */
export const startTestDatabase = async ({ migrate = true } = {}): Promise<TestDatabase> => {
  const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  const url = container.getConnectionUri();
  const handle = createDb(url, { maxConnections: 5 });
  if (migrate) await runMigrations(handle.db);
  return {
    ...handle,
    url,
    stop: async () => {
      await handle.close();
      await container.stop();
    },
  };
};

/**
 * Empties every application table between tests (keeps the migration history).
 *
 * 在测试之间清空所有业务表（保留迁移记录）。
 */
export const truncateAll = async ({ db }: DbHandle) => {
  await db.execute(sql`TRUNCATE todos, sessions, accounts, verifications, users CASCADE`);
};
