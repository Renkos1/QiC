import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.js";

/**
 * Typed Drizzle database bound to this package's schema.
 *
 * 绑定了本包 schema 的 Drizzle 数据库类型；仓储层只通过它访问数据库。
 */
export type Database = NodePgDatabase<typeof schema>;

/**
 * A Drizzle client plus the pool behind it.
 *
 * Drizzle 客户端及其底层连接池。
 */
export interface DbHandle {
  /** Query builder. 查询入口。 */
  db: Database;
  /** Raw pool, e.g. for readiness checks. 原始连接池，例如用于就绪检查。 */
  pool: pg.Pool;
  /** Drains the pool; call on graceful shutdown. 关闭连接池；在优雅停机时调用。 */
  close: () => Promise<void>;
}

/**
 * Options for {@link createDb}.
 *
 * {@link createDb} 的选项。
 */
export interface CreateDbOptions {
  /** Maximum pool size; pg defaults to 10. 连接池上限，默认 10。 */
  maxConnections?: number;
}

/**
 * Creates a pooled Drizzle client. Column names map camelCase fields to snake_case.
 *
 * 创建带连接池的 Drizzle 客户端；代码中的 camelCase 字段自动映射为数据库中的 snake_case 列。
 *
 * @param connectionString - Postgres URL, usually from {@link resolveDatabaseUrl}.
 *   Postgres 连接串，通常来自 {@link resolveDatabaseUrl}。
 * @param options - Pool settings. 连接池设置。
 * @returns The client, pool and a `close` function. 客户端、连接池和 `close` 函数。
 */
export const createDb = (connectionString: string, options: CreateDbOptions = {}): DbHandle => {
  const pool = new pg.Pool({ connectionString, max: options.maxConnections });
  const db = drizzle({ client: pool, schema, casing: "snake_case" });
  return { db, pool, close: () => pool.end() };
};
