import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, type OnApplicationBootstrap } from "@nestjs/common";
import { EMAIL_QUEUE, NOTIFICATIONS_QUEUE } from "@qic/contracts";
import type { Logger } from "@qic/logger";
import type { Mailer } from "@qic/mail";
import type { Job } from "bullmq";
import type { DeadLetterSink } from "./dead-letter.js";
import { createSendEmailProcessor } from "./jobs/send-email.js";
import { createTodoCompletedProcessor } from "./jobs/todo-completed.js";
import { DEAD_LETTERS, LOGGER, MAILER, WORKER_CONFIG, type WorkerConfig } from "./tokens.js";

type JobHandler = (job: Job<unknown>) => Promise<void>;

/**
 * Nest wiring shared by every queue: delegates to a plain job handler (src/jobs, unit
 * tested without Nest), dead-letters final failures and applies the configured
 * concurrency. The worker is closed gracefully by @nestjs/bullmq on shutdown.
 *
 * 各队列共用的 Nest 装配：把任务交给纯函数处理器（src/jobs，无需 Nest 即可单测），
 * 最终失败写入死信，并应用配置的并发数。停机时 @nestjs/bullmq 会等待进行中的任务完成再关闭。
 */
abstract class QueueProcessor extends WorkerHost implements OnApplicationBootstrap {
  constructor(
    private readonly queue: string,
    private readonly handler: JobHandler,
    private readonly deadLetters: DeadLetterSink,
    private readonly config: WorkerConfig,
  ) {
    super();
  }

  /** Called by BullMQ for each job. BullMQ 为每个任务调用。 */
  process(job: Job<unknown>) {
    return this.handler(job);
  }

  /** Records failed attempts (dead-letters final ones). 记录失败；最终失败写入死信。 */
  @OnWorkerEvent("failed")
  onFailed(job: Job | undefined, error: Error) {
    this.deadLetters.record(this.queue, job, error);
  }

  /** Applies the configured concurrency once the worker exists. worker 创建后应用并发配置。 */
  onApplicationBootstrap() {
    // @Processor options are fixed at import time; concurrency comes from the environment.
    this.worker.concurrency = this.config.concurrency;
  }
}

/**
 * Consumes the `email` queue (verification and password-reset mail).
 *
 * 消费 `email` 队列（邮箱验证、重置密码邮件）。
 */
@Processor(EMAIL_QUEUE)
export class EmailProcessor extends QueueProcessor {
  constructor(
    @Inject(MAILER) mailer: Mailer,
    @Inject(LOGGER) logger: Logger,
    @Inject(DEAD_LETTERS) deadLetters: DeadLetterSink,
    @Inject(WORKER_CONFIG) config: WorkerConfig,
  ) {
    super(EMAIL_QUEUE, createSendEmailProcessor({ mailer, logger }), deadLetters, config);
  }
}

/**
 * Consumes the `notifications` queue (todo-completed mail).
 *
 * 消费 `notifications` 队列（待办完成通知）。
 */
@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends QueueProcessor {
  constructor(
    @Inject(MAILER) mailer: Mailer,
    @Inject(LOGGER) logger: Logger,
    @Inject(DEAD_LETTERS) deadLetters: DeadLetterSink,
    @Inject(WORKER_CONFIG) config: WorkerConfig,
  ) {
    super(
      NOTIFICATIONS_QUEUE,
      createTodoCompletedProcessor({ mailer, logger }),
      deadLetters,
      config,
    );
  }
}
