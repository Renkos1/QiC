import { z } from "zod";

/**
 * Jobs that exhausted their retries (or failed unrecoverably) are copied here with
 * their original payload so they can be inspected and replayed. BullMQ has no
 * built-in dead-letter queue; the worker moves them explicitly.
 *
 * 死信队列：重试耗尽或不可恢复失败的任务连同原始负载复制到这里，便于排查和重放。
 * BullMQ 没有内置死信队列，由 worker 显式转移；这里的任务永不自动删除。
 */
export const DEAD_LETTER_QUEUE = "dead-letter";

/**
 * A dead letter: the failed job's identity, original payload and last error.
 *
 * 一条死信：失败任务的标识、原始负载和最后一次错误。
 */
export const DeadLetterJobSchema = z.object({
  /** Source queue. 来源队列。 */
  queue: z.string(),
  jobName: z.string(),
  jobId: z.string().optional(),
  /** Original payload, unvalidated. 原始负载，不做校验。 */
  data: z.unknown(),
  failedReason: z.string(),
  attemptsMade: z.number().int().min(0),
  failedAt: z.iso.datetime(),
});

/** A dead letter. 一条死信。 */
export type DeadLetterJob = z.infer<typeof DeadLetterJobSchema>;
