import type { DeadLetterJob } from "@qic/contracts";
import type { Logger } from "@qic/logger";
import { type ErrorReporter, NOOP_ERROR_REPORTER } from "@qic/telemetry";
import type { Job, Queue } from "bullmq";

/**
 * A failure is final when the error is unrecoverable or no attempts remain; BullMQ
 * will not retry the job again, so it must be preserved for inspection or replay.
 *
 * 判断失败是否为最终失败：错误不可恢复，或重试次数已用完。此时 BullMQ 不会再重试，
 * 必须把任务保存下来以便排查或重放。
 *
 * @param job - Attempt count and options. 已尝试次数和任务选项。
 * @param error - The failure. 失败原因。
 */
export const isFinalFailure = (job: Pick<Job, "attemptsMade" | "opts">, error: Error): boolean =>
  error.name === "UnrecoverableError" || job.attemptsMade >= (job.opts.attempts ?? 1);

/**
 * Builds the dead-letter record for a failed job, keeping its original payload.
 *
 * 为失败的任务构造死信记录，保留原始负载。
 *
 * @param queue - Source queue. 来源队列。
 * @param job - The failed job. 失败的任务。
 * @param error - Last error. 最后一次错误。
 * @param now - Failure time (injectable for tests). 失败时间（便于测试注入）。
 */
export const toDeadLetter = (
  queue: string,
  job: Pick<Job, "name" | "id" | "data" | "attemptsMade">,
  error: Error,
  now: Date = new Date(),
): DeadLetterJob => ({
  queue,
  jobName: job.name,
  jobId: job.id,
  data: job.data,
  failedReason: error.message,
  attemptsMade: job.attemptsMade,
  failedAt: now.toISOString(),
});

/**
 * Receives worker `failed` events.
 *
 * 接收 worker 的 `failed` 事件。
 */
export interface DeadLetterSink {
  /** Handles a worker's `failed` event for jobs consumed from `queue`. 处理 `queue` 上任务的失败事件。 */
  record: (queue: string, job: Job | undefined, error: Error) => void;
}

/**
 * Creates the sink: retryable failures are logged as warnings; final failures are logged
 * as errors, reported and copied to the dead-letter queue. Losing a dead letter is logged as fatal.
 *
 * 创建死信记录器：可重试的失败记 warn；最终失败记 error、上报错误并复制到死信队列；
 * 写死信失败记 fatal（这是负载的唯一副本）。
 *
 * @param deadLetters - The dead-letter queue; its jobs must never be auto-removed. 死信队列，其中任务永不自动删除。
 * @param logger - Root logger. 根日志器。
 * @param errors - Receives final failures (not the payload). 接收最终失败（不含负载）。
 */
export const createDeadLetterSink = (
  deadLetters: Pick<Queue<DeadLetterJob>, "add">,
  logger: Logger,
  errors: Pick<ErrorReporter, "capture"> = NOOP_ERROR_REPORTER,
): DeadLetterSink => ({
  record: (queue, job, error) => {
    if (!job) return;
    const base = { queue, jobId: job.id, jobName: job.name, attemptsMade: job.attemptsMade };
    if (!isFinalFailure(job, error)) {
      logger.warn({ ...base, err: error }, "job failed, will retry");
      return;
    }
    logger.error({ ...base, err: error }, "job failed permanently, moving to dead-letter queue");
    errors.capture(error, base);
    deadLetters.add(`${queue}:${job.name}`, toDeadLetter(queue, job, error)).catch((dlqError) => {
      // Losing a dead letter must be loud: this is the only copy of the payload.
      logger.fatal({ ...base, err: dlqError }, "failed to write dead letter");
    });
  },
});
