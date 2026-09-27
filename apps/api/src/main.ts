import "reflect-metadata";

/*
 * api entrypoint: builds infrastructure from the environment, starts Nest on PORT and
 * shuts down in order (HTTP, queues, Redis, database, telemetry) on SIGINT/SIGTERM.
 * Started with `--import ./src/instrument.ts` (dist/instrument.js in production) so
 * OpenTelemetry is set up before anything below is imported.
 *
 * api 入口。按环境变量创建基础设施，在 PORT 上启动 Nest；收到 SIGINT/SIGTERM 时按顺序关闭
 * （HTTP、队列、Redis、数据库、遥测）。启动时带 `--import ./src/instrument.ts`
 * （生产环境为 dist/instrument.js），保证 OpenTelemetry 先于下面的所有导入完成初始化。
 */
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createLanguageModel, enableAiTelemetry } from "@qic/ai";
import { DEAD_LETTER_QUEUE } from "@qic/contracts";
import { createDb } from "@qic/db";
import { createLogger, createNestLogger } from "@qic/logger";
import { createErrorReporter, getTelemetry } from "@qic/telemetry";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { AppModule } from "./app.module.js";
import { loadEnv } from "./env.js";
import { configureHttpApp, HTTP_APP_OPTIONS } from "./http-app.js";
import { createRedisRateLimiter } from "./lib/rate-limiter.js";
import { createEmailQueue } from "./queue/email.js";
import { createNotificationQueue } from "./queue/notifications.js";

const env = loadEnv();
const logger = createLogger({
  service: "api",
  env: env.NODE_ENV,
  release: env.GIT_SHA,
  level: env.LOG_LEVEL,
  pretty: env.NODE_ENV === "development",
});
const telemetry = getTelemetry();
logger.info(
  { exporters: telemetry.exporters },
  telemetry.exporters.length
    ? "telemetry enabled"
    : "OTEL_EXPORTER_OTLP_ENDPOINT not set; telemetry disabled",
);
const errors = createErrorReporter({
  service: "api",
  dsn: env.SENTRY_DSN,
  release: env.GIT_SHA,
  environment: env.NODE_ENV,
  logger,
});

const database = createDb(env.DATABASE_URL);
const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2 });
const emailQueue = createEmailQueue(env.REDIS_URL);
const notificationQueue = createNotificationQueue(env.REDIS_URL);
const model = createLanguageModel({ apiKey: env.ANTHROPIC_API_KEY, modelId: env.AI_MODEL });
if (!model) logger.info("ANTHROPIC_API_KEY not set; AI features disabled");
enableAiTelemetry({
  pricing:
    env.AI_PRICE_INPUT_USD_PER_MTOK !== undefined && env.AI_PRICE_OUTPUT_USD_PER_MTOK !== undefined
      ? {
          inputUsdPerMTok: env.AI_PRICE_INPUT_USD_PER_MTOK,
          outputUsdPerMTok: env.AI_PRICE_OUTPUT_USD_PER_MTOK,
        }
      : undefined,
  recordContent: env.AI_TRACE_CONTENT,
});
const rateLimiter = env.RATE_LIMIT_ENABLED ? createRedisRateLimiter(redis) : null;
if (!rateLimiter) logger.info("RATE_LIMIT_ENABLED is off; rate limiting disabled");

const app = await NestFactory.create<NestExpressApplication>(
  AppModule.forRoot({
    database,
    redis,
    logger,
    config: {
      publicWebUrl: env.PUBLIC_WEB_URL,
      authSecret: env.BETTER_AUTH_SECRET,
      gitSha: env.GIT_SHA,
    },
    model,
    sendEmail: emailQueue.enqueue,
    notifyTodoCompleted: notificationQueue.todoCompleted,
    rateLimiter,
  }),
  { ...HTTP_APP_OPTIONS, logger: createNestLogger(logger) },
);

// Development-only job dashboard: no authentication, and a devDependency that production
// images do not contain, hence the dynamic import.
let deadLetterQueue: Queue | null = null;
let bullBoardPath: string | undefined;
if (env.NODE_ENV === "development") {
  const { BULL_BOARD_PATH, mountBullBoard } = await import("./admin/bull-board.js");
  deadLetterQueue = new Queue(DEAD_LETTER_QUEUE, { connection: { url: env.REDIS_URL } });
  mountBullBoard(app, [emailQueue.queue, notificationQueue.queue, deadLetterQueue]);
  bullBoardPath = BULL_BOARD_PATH;
}

configureHttpApp(app, logger, errors);
await app.listen(env.PORT);
logger.info(
  { port: env.PORT, sha: env.GIT_SHA, ...(bullBoardPath && { bullBoard: bullBoardPath }) },
  "api listening",
);

let shuttingDown = false;
const shutdown = async (signal: NodeJS.Signals) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "shutting down");
  // Stop accepting connections first, then release resources in-flight requests may still use.
  await app.close();
  await Promise.all([emailQueue.close(), notificationQueue.close(), deadLetterQueue?.close()]);
  redis.disconnect();
  await database.close();
  logger.info("shutdown complete");
  // Last, so the lines above are exported too.
  await Promise.all([errors.flush(), telemetry.shutdown()]);
  process.exit(0);
};

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, (received) => {
    shutdown(received).catch((error: unknown) => {
      logger.fatal({ err: error }, "shutdown failed");
      process.exit(1);
    });
  });
}
