/*
 * Injection tokens. Providers are always injected with `@Inject(TOKEN)` rather than by
 * class type, so the build needs no `emitDecoratorMetadata` (tsx, Vitest and the
 * TypeScript 7 checker do not emit it).
 *
 * 依赖注入令牌。所有依赖都用 `@Inject(TOKEN)` 显式注入，而不是按类类型自动注入，
 * 因此不需要 `emitDecoratorMetadata`（tsx、Vitest 和 TS 7 原生编译器都不生成它）。
 * 新增依赖时先在这里声明令牌。
 */
/** Root pino logger (`Logger`). 根日志器。 */
export const LOGGER = Symbol("LOGGER");
/** Drizzle client and pool (`DbHandle`). 数据库客户端与连接池。 */
export const DATABASE = Symbol("DATABASE");
/** Shared ioredis connection (`Redis`). 共享的 Redis 连接。 */
export const REDIS = Symbol("REDIS");
/** AI model, or `null` when AI is disabled (`LanguageModel | null`). AI 模型；未配置时为 `null`。 */
export const LANGUAGE_MODEL = Symbol("LANGUAGE_MODEL");
/** Static app settings ({@link AppConfig}). 静态应用配置。 */
export const APP_CONFIG = Symbol("APP_CONFIG");
/** Enqueues a transactional email for the worker. 把事务邮件投递给 worker。 */
export const SEND_EMAIL = Symbol("SEND_EMAIL");
/** Enqueues the todo-completed notification for the worker. 把待办完成通知投递给 worker。 */
export const NOTIFY_TODO_COMPLETED = Symbol("NOTIFY_TODO_COMPLETED");
/** Better Auth instance (`AuthRuntime`). Better Auth 实例。 */
export const AUTH = Symbol("AUTH");
/** Shared rate limiter, or `null` when `RATE_LIMIT_ENABLED` is off (`RateLimiter | null`). 共享限流器；关闭时为 `null`。 */
export const RATE_LIMITER = Symbol("RATE_LIMITER");
/** Checks behind `/readyz` (`Record<string, ReadinessCheck>`). `/readyz` 执行的就绪检查。 */
export const READINESS_CHECKS = Symbol("READINESS_CHECKS");
/** The todo domain service (`TodoService`). 待办领域服务。 */
export const TODO_SERVICE = Symbol("TODO_SERVICE");

/**
 * Static settings resolved from the environment at startup.
 *
 * 启动时从环境变量解析出的静态配置。
 */
export interface AppConfig {
  /** Public origin users see (the web app). 用户访问的公开地址（web 应用）。 */
  publicWebUrl: string;
  /** `BETTER_AUTH_SECRET`: signs sessions and tokens. 会话与令牌的签名密钥。 */
  authSecret: string;
  /** Build identifier reported by /healthz. `/healthz` 返回的构建标识。 */
  gitSha: string;
}
