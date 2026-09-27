import { z } from "zod";

/**
 * Queue for user notifications. Producer: api. Consumer: worker.
 *
 * 用户通知队列。生产者：api；消费者：worker。
 */
export const NOTIFICATIONS_QUEUE = "notifications";

/**
 * Job name for {@link TodoCompletedJobSchema} payloads.
 *
 * {@link TodoCompletedJobSchema} 负载对应的任务名。
 */
export const TODO_COMPLETED_JOB = "todo-completed";

/**
 * Emitted when a todo transitions from open to completed. Carries everything the
 * worker needs to notify the user, so the worker does not read the api's tables.
 *
 * 待办从未完成变为已完成时投递。负载包含通知所需的全部信息，
 * 因此 worker 不需要读取 api 的数据表（遵守“模块不读写他人表”的规则）。
 */
export const TodoCompletedJobSchema = z.object({
  todoId: z.uuid(),
  userId: z.string().min(1),
  title: z.string().min(1),
  to: z.email(),
  name: z.string().min(1),
  /**
   * Link back to the todo list in the web app.
   *
   * 指回 web 端待办列表的链接。
   */
  url: z.url(),
});

/** Payload of a `todo-completed` job. 待办完成通知的负载。 */
export type TodoCompletedJob = z.infer<typeof TodoCompletedJobSchema>;

/**
 * Retry policy for notification jobs: 5 attempts, exponential backoff from 2s.
 *
 * 通知任务的重试策略：最多 5 次，从 2 秒开始指数退避；记录保留时长与邮件任务相同。
 */
export const NOTIFICATION_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: "exponential", delay: 2_000 },
  removeOnComplete: { age: 24 * 60 * 60, count: 1_000 },
  removeOnFail: { age: 7 * 24 * 60 * 60 },
} as const;
