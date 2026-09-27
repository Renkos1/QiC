import {
  NOTIFICATION_JOB_OPTIONS,
  NOTIFICATIONS_QUEUE,
  TODO_COMPLETED_JOB,
  type TodoCompletedJob,
  TodoCompletedJobSchema,
} from "@qic/contracts";
import { Queue } from "bullmq";
import { queueBaseOptions } from "./options.js";

/**
 * Producer side of the notifications queue.
 *
 * 通知队列的生产者。
 */
export interface NotificationQueue {
  /** Validates and enqueues a todo-completed job. 校验并投递待办完成任务。 */
  todoCompleted: (job: TodoCompletedJob) => Promise<void>;
  /** The underlying queue, for dashboards such as Bull Board. 底层队列，供 Bull Board 等面板使用。 */
  readonly queue: Queue;
  /** Closes the Redis connection on shutdown. 停机时关闭连接。 */
  close: () => Promise<void>;
}

/**
 * Creates the notifications producer with the contract's retry policy.
 *
 * 创建通知生产者，使用契约中定义的重试策略。
 *
 * @param redisUrl - Redis connection URL. Redis 连接串。
 */
export const createNotificationQueue = (redisUrl: string): NotificationQueue => {
  const queue = new Queue(NOTIFICATIONS_QUEUE, {
    ...queueBaseOptions(redisUrl),
    defaultJobOptions: NOTIFICATION_JOB_OPTIONS,
  });
  return {
    queue,
    todoCompleted: async (job) => {
      await queue.add(TODO_COMPLETED_JOB, TodoCompletedJobSchema.parse(job));
    },
    close: () => queue.close(),
  };
};
