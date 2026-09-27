import "reflect-metadata";

/*
 * worker entrypoint: starts the queue consumers and the /healthz endpoint on
 * WORKER_HEALTH_PORT; on SIGINT/SIGTERM waits for in-flight jobs, then closes SMTP and
 * flushes telemetry. Started with `--import ./src/instrument.ts` like the api.
 *
 * worker 入口：启动队列消费者，并在 WORKER_HEALTH_PORT 上提供 /healthz；
 * 收到 SIGINT/SIGTERM 时等待进行中的任务完成，再关闭 SMTP 连接并刷出遥测数据。
 * 与 api 一样通过 `--import ./src/instrument.ts` 启动。
 */
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { EMAIL_QUEUE, NOTIFICATIONS_QUEUE } from "@qic/contracts";
import { createLogger, createNestLogger } from "@qic/logger";
import { createSmtpMailer } from "@qic/mail";
import { createErrorReporter, getTelemetry } from "@qic/telemetry";
import { loadEnv } from "./env.js";
import { WorkerModule } from "./worker.module.js";

const env = loadEnv();
const logger = createLogger({
  service: "worker",
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
  service: "worker",
  dsn: env.SENTRY_DSN,
  release: env.GIT_SHA,
  environment: env.NODE_ENV,
  logger,
});

const mailer = createSmtpMailer({ url: env.SMTP_URL, from: env.MAIL_FROM });

const app = await NestFactory.create<NestExpressApplication>(
  WorkerModule.forRoot({
    redisUrl: env.REDIS_URL,
    logger,
    mailer,
    config: { concurrency: env.WORKER_CONCURRENCY },
    errors,
  }),
  { logger: createNestLogger(logger) },
);
app.disable("x-powered-by");
await app.listen(env.WORKER_HEALTH_PORT);

logger.info(
  {
    queues: [EMAIL_QUEUE, NOTIFICATIONS_QUEUE],
    concurrency: env.WORKER_CONCURRENCY,
    healthPort: env.WORKER_HEALTH_PORT,
  },
  "worker started",
);

let shuttingDown = false;
const shutdown = async (signal: NodeJS.Signals) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "shutting down");
  // close() waits for in-flight jobs (via @nestjs/bullmq) so none are left half-processed.
  await app.close();
  mailer.close();
  logger.info("shutdown complete");
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
