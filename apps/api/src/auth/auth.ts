import type { SendEmailJob } from "@qic/contracts";
import { accounts, type Database, sessions, users, verifications } from "@qic/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { RateLimiter } from "../lib/rate-limiter.js";

/**
 * Inputs of {@link createAuth}.
 *
 * {@link createAuth} 的输入。
 */
export interface AuthDeps {
  /** Database holding the auth tables. 存放鉴权表的数据库。 */
  db: Database;
  /** Public web origin; verification and reset links point here and are proxied to the api. 公开 web 地址；邮件链接指向这里并被代理到 api。 */
  publicWebUrl: string;
  /** `BETTER_AUTH_SECRET`: signs sessions and tokens. 会话与令牌的签名密钥。 */
  secret: string;
  /** Hands the email to the worker queue; never sends inside the request. 把邮件交给 worker 队列，不在请求中发送。 */
  sendEmail: (job: SendEmailJob) => Promise<void>;
  /**
   * Shared limiter for auth routes, or null to disable rate limiting (development, tests).
   * 鉴权路由共用的限流器；为 null 时关闭限流（开发、测试环境）。
   */
  rateLimiter: RateLimiter | null;
}

/** Mount point of Better Auth's routes. Better Auth 路由的挂载路径。 */
export const AUTH_BASE_PATH = "/api/auth";

/**
 * Email + password auth with mandatory verification. Social providers are added
 * here via `socialProviders` once an ADR approves them.
 *
 * 创建 Better Auth 实例：邮箱 + 密码登录，必须验证邮箱；重置密码后注销所有会话。
 * 社交登录经 ADR 批准后在此通过 `socialProviders` 添加。
 * 限流沿用 Better Auth 的默认规则（按“客户端 IP + 路径”计数：一般每 10 秒 100 次；登录、注册每 10 秒 3 次；
 * 申请重置密码、重发验证邮件每 60 秒 3 次），计数存放在 Redis 中。客户端 IP 取自 Caddy 写入的单值 `X-Forwarded-For`。
 *
 * @param deps - Database, public URL, secret and the email sender. 数据库、公开地址、密钥和邮件发送函数。
 */
export const createAuth = ({ db, publicWebUrl, secret, sendEmail, rateLimiter }: AuthDeps) =>
  betterAuth({
    appName: "QiC",
    baseURL: publicWebUrl,
    basePath: AUTH_BASE_PATH,
    secret,
    trustedOrigins: [publicWebUrl],
    database: drizzleAdapter(db, {
      provider: "pg",
      usePlural: true,
      schema: { users, sessions, accounts, verifications },
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 8,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendEmail({ template: "reset-password", to: user.email, name: user.name, url });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      // Unverified users who try to sign in get a fresh link instead of being stuck.
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmail({ template: "verify-email", to: user.email, name: user.name, url });
      },
    },
    // Better Auth's default rules apply (stricter on sign-in, sign-up and reset emails);
    // counters live in Redis so they survive restarts and are shared across instances.
    rateLimit: rateLimiter ? { enabled: true, customStorage: rateLimiter } : { enabled: false },
    telemetry: { enabled: false },
  });

/** The Better Auth instance type. Better Auth 实例类型。 */
export type Auth = ReturnType<typeof createAuth>;
/** A resolved session with its user. 解析后的会话及其用户。 */
export type AuthSession = Auth["$Infer"]["Session"];
