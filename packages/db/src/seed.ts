import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, count, eq } from "drizzle-orm";
import type { Database } from "./client.js";
import { accounts, todos, users } from "./schema/index.js";

/**
 * Demo credentials; documented in README. Development only.
 *
 * 演示账号，已写入 README。仅用于开发环境，`pnpm db:seed` 在生产环境会拒绝运行。
 */
export const DEMO_USER = {
  name: "Demo User",
  email: "demo@qic.local",
  password: "demo-password-123",
} as const;

// Better Auth stores email/password logins as an account with this provider id.
const CREDENTIAL_PROVIDER_ID = "credential";

/**
 * Todos created for the demo user on first seed.
 *
 * 首次播种时为演示用户创建的待办。
 */
export const DEMO_TODOS = [
  "阅读 README 与 AGENTS.md",
  "运行 pnpm check",
  "完成第一个 Todo",
] as const;

/**
 * Seeds a verified demo user plus a few todos for local development and tests.
 * Idempotent: existing rows are left untouched, so it is safe to run repeatedly.
 *
 * 写入一个已验证邮箱的演示用户和几条待办，用于本地开发和测试。
 * 幂等：已存在的数据保持不变，可以重复运行。
 *
 * @param db - Target database. 目标数据库。
 */
export const seedDemoData = async (db: Database): Promise<void> => {
  await db.transaction(async (tx) => {
    await tx
      .insert(users)
      .values({
        id: randomUUID(),
        name: DEMO_USER.name,
        email: DEMO_USER.email,
        emailVerified: true,
      })
      .onConflictDoNothing({ target: users.email });

    const [user] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, DEMO_USER.email));
    if (!user) throw new Error("Demo user missing after upsert");

    const [existingAccount] = await tx
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.userId, user.id), eq(accounts.providerId, CREDENTIAL_PROVIDER_ID)));
    if (!existingAccount) {
      await tx.insert(accounts).values({
        id: randomUUID(),
        userId: user.id,
        accountId: user.id,
        providerId: CREDENTIAL_PROVIDER_ID,
        password: await hashPassword(DEMO_USER.password),
      });
    }

    const [todoCount] = await tx
      .select({ value: count() })
      .from(todos)
      .where(eq(todos.userId, user.id));
    if (todoCount?.value === 0) {
      await tx.insert(todos).values(DEMO_TODOS.map((title) => ({ userId: user.id, title })));
    }
  });
};
