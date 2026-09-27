/*
 * Migrations against a real Postgres container: idempotent re-runs and schema parity
 * with drizzle-kit. Requires Docker.
 *
 * 对真实 Postgres 容器执行迁移：可重复执行，以及与 drizzle-kit 生成的 schema 一致。需要 Docker。
 */
import { count, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrations } from "./migrate.js";
import { accounts, todos, users } from "./schema/index.js";
import { DEMO_TODOS, seedDemoData } from "./seed.js";
import { startTestDatabase, type TestDatabase } from "./testing.js";

let database: TestDatabase;

beforeAll(async () => {
  database = await startTestDatabase({ migrate: false });
});

afterAll(async () => {
  await database?.stop();
});

/** Schema fingerprint that ignores data: tables, columns, types and indexes. */
const schemaSnapshot = async () => {
  const columns = await database.db.execute(sql`
    SELECT table_name, column_name, data_type, datetime_precision, is_nullable, column_default
    FROM information_schema.columns WHERE table_schema = 'public'
    ORDER BY table_name, column_name`);
  const indexes = await database.db.execute(sql`
    SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY indexname`);
  return JSON.stringify([columns.rows, indexes.rows]);
};

const countRows = async () => ({
  users: (await database.db.select({ n: count() }).from(users))[0]?.n,
  accounts: (await database.db.select({ n: count() }).from(accounts))[0]?.n,
  todos: (await database.db.select({ n: count() }).from(todos))[0]?.n,
});

describe("migrations", () => {
  it("should create the schema when applied to an empty database", async () => {
    await runMigrations(database.db);

    const tables = await database.db.execute(sql`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`);
    expect(tables.rows.map((row) => row.tablename)).toEqual([
      "accounts",
      "sessions",
      "todos",
      "users",
      "verifications",
    ]);
  });

  it("should leave the schema unchanged when applied again", async () => {
    const before = await schemaSnapshot();
    await runMigrations(database.db);
    expect(await schemaSnapshot()).toBe(before);
  });
});

describe("seed", () => {
  it("should create the demo user and todos once when run repeatedly", async () => {
    await seedDemoData(database.db);
    const first = await countRows();
    await seedDemoData(database.db);

    expect(first).toEqual({ users: 1, accounts: 1, todos: DEMO_TODOS.length });
    expect(await countRows()).toEqual(first);
  });
});
