import { type DynamicModule, Module } from "@nestjs/common";
import type { LanguageModel } from "@qic/ai";
import type { SendEmailJob, TodoCompletedJob } from "@qic/contracts";
import type { DbHandle } from "@qic/db";
import type { Logger } from "@qic/logger";
import type { Redis } from "ioredis";
import { createAuth } from "./auth/auth.js";
import { HealthController } from "./health/health.controller.js";
import type { ReadinessCheck } from "./health/readiness.js";
import type { RateLimiter } from "./lib/rate-limiter.js";
import { SystemModule } from "./modules/system/system.module.js";
import { TodosModule } from "./modules/todos/index.js";
import {
  APP_CONFIG,
  type AppConfig,
  AUTH,
  DATABASE,
  LANGUAGE_MODEL,
  LOGGER,
  NOTIFY_TODO_COMPLETED,
  RATE_LIMITER,
  READINESS_CHECKS,
  REDIS,
  SEND_EMAIL,
} from "./tokens.js";

/**
 * Infrastructure handed to {@link AppModule.forRoot}.
 *
 * 传给 {@link AppModule.forRoot} 的基础设施。
 */
export interface AppDeps {
  /** Postgres client and pool. 数据库客户端与连接池。 */
  database: DbHandle;
  /** Shared Redis connection (idempotency, readiness). 共享 Redis 连接（幂等、就绪检查）。 */
  redis: Redis;
  /** Root logger. 根日志器。 */
  logger: Logger;
  /** Static settings. 静态配置。 */
  config: AppConfig;
  /** AI model, or null when AI is disabled. AI 模型；未配置时为 null。 */
  model: LanguageModel | null;
  /** Enqueues an email; a recorder in tests. 投递邮件；测试中为记录器。 */
  sendEmail: (job: SendEmailJob) => Promise<void>;
  /** Enqueues the completion notification; a recorder in tests. 投递完成通知；测试中为记录器。 */
  notifyTodoCompleted: (job: TodoCompletedJob) => Promise<void>;
  /** Shared limiter for auth and `@RateLimit` routes; null disables limiting. 共享限流器；为 null 时关闭限流。 */
  rateLimiter: RateLimiter | null;
}

/**
 * Root module. Infrastructure is created by the caller (main.ts, or the integration
 * tests with containers) and handed in, so the caller also owns its shutdown order.
 *
 * 根模块。基础设施（数据库、Redis、队列等）由调用方（main.ts 或使用容器的集成测试）创建后传入，
 * 因此由调用方负责关闭顺序。基础设施提供者全局可见，各功能模块通过令牌注入。
 */
@Module({})
export class AppModule {
  /**
   * Builds the root module around the given infrastructure.
   *
   * 用给定的基础设施构建根模块。
   *
   * @param deps - Infrastructure and side effects. 基础设施和副作用。
   */
  static forRoot(deps: AppDeps): DynamicModule {
    const shared = [
      { provide: LOGGER, useValue: deps.logger },
      { provide: DATABASE, useValue: deps.database },
      { provide: REDIS, useValue: deps.redis },
      { provide: LANGUAGE_MODEL, useValue: deps.model },
      { provide: APP_CONFIG, useValue: deps.config },
      { provide: SEND_EMAIL, useValue: deps.sendEmail },
      { provide: RATE_LIMITER, useValue: deps.rateLimiter },
      { provide: NOTIFY_TODO_COMPLETED, useValue: deps.notifyTodoCompleted },
      {
        provide: AUTH,
        useValue: createAuth({
          db: deps.database.db,
          publicWebUrl: deps.config.publicWebUrl,
          secret: deps.config.authSecret,
          sendEmail: deps.sendEmail,
          rateLimiter: deps.rateLimiter,
        }),
      },
    ];
    const readiness: Record<string, ReadinessCheck> = {
      database: async () => {
        await deps.database.pool.query("select 1");
      },
      redis: async () => {
        await deps.redis.ping();
      },
    };
    return {
      module: AppModule,
      // Infrastructure providers are visible to every feature module.
      global: true,
      imports: [SystemModule, TodosModule],
      controllers: [HealthController],
      providers: [...shared, { provide: READINESS_CHECKS, useValue: readiness }],
      exports: shared.map(({ provide }) => provide),
    };
  }
}
