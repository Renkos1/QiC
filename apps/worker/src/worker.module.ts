import { BullModule, getQueueToken } from "@nestjs/bullmq";
import { type DynamicModule, Module } from "@nestjs/common";
import { DEAD_LETTER_QUEUE, EMAIL_QUEUE, NOTIFICATIONS_QUEUE } from "@qic/contracts";
import type { Logger } from "@qic/logger";
import type { Mailer } from "@qic/mail";
import type { ErrorReporter } from "@qic/telemetry";
import type { Queue } from "bullmq";
import { BullMQOtel } from "bullmq-otel";
import { createDeadLetterSink } from "./dead-letter.js";
import { HealthController } from "./health.controller.js";
import { EmailProcessor, NotificationsProcessor } from "./processors.js";
import { QueueMetrics } from "./queue-metrics.js";
import {
  DEAD_LETTERS,
  LOGGER,
  MAILER,
  WORKER_CONFIG,
  WORKER_HEALTH,
  type WorkerConfig,
} from "./tokens.js";

/**
 * Infrastructure handed to {@link WorkerModule.forRoot}.
 *
 * 传给 {@link WorkerModule.forRoot} 的基础设施。
 */
export interface WorkerDeps {
  /** BullMQ connection. BullMQ 连接串。 */
  redisUrl: string;
  /** Root logger. 根日志器。 */
  logger: Logger;
  /** SMTP mailer; closed by the caller. SMTP 发信器，由调用方关闭。 */
  mailer: Mailer;
  /** Runtime settings. 运行时配置。 */
  config: WorkerConfig;
  /** Receives jobs that failed for good. 接收最终失败的任务。 */
  errors: ErrorReporter;
}

/**
 * Root module of the worker: BullMQ connection (with trace propagation), queues,
 * processors, backlog metrics and the health endpoint.
 *
 * worker 的根模块：BullMQ 连接（含 trace 传递）、队列注册、处理器、积压指标和健康检查接口。
 */
@Module({})
export class WorkerModule {
  /**
   * Builds the module around the given infrastructure.
   *
   * 用给定的基础设施构建模块。
   *
   * @param deps - Redis URL, logger, mailer, settings and error reporter. Redis 地址、日志器、发信器、配置和错误上报器。
   */
  static forRoot({ redisUrl, logger, mailer, config, errors }: WorkerDeps): DynamicModule {
    return {
      module: WorkerModule,
      imports: [
        // Telemetry makes each job continue the trace of the request that enqueued it.
        BullModule.forRoot({
          connection: { url: redisUrl },
          telemetry: new BullMQOtel({ tracerName: "bullmq", enableMetrics: true }),
        }),
        BullModule.registerQueue(
          { name: EMAIL_QUEUE },
          { name: NOTIFICATIONS_QUEUE },
          // Dead letters are the record of last resort: never auto-remove them.
          {
            name: DEAD_LETTER_QUEUE,
            defaultJobOptions: { removeOnComplete: false, removeOnFail: false },
          },
        ),
      ],
      controllers: [HealthController],
      providers: [
        { provide: LOGGER, useValue: logger },
        { provide: MAILER, useValue: mailer },
        { provide: WORKER_CONFIG, useValue: config },
        {
          provide: DEAD_LETTERS,
          inject: [getQueueToken(DEAD_LETTER_QUEUE)],
          useFactory: (queue: Queue) => createDeadLetterSink(queue, logger, errors),
        },
        EmailProcessor,
        NotificationsProcessor,
        QueueMetrics,
        {
          provide: WORKER_HEALTH,
          inject: [EmailProcessor, NotificationsProcessor],
          useFactory:
            (...processors: (EmailProcessor | NotificationsProcessor)[]) =>
            () =>
              processors.every((processor) => processor.worker.isRunning()),
        },
      ],
    };
  }
}
