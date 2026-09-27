import {
  EMAIL_JOB_OPTIONS,
  EMAIL_QUEUE,
  SEND_EMAIL_JOB,
  type SendEmailJob,
  SendEmailJobSchema,
} from "@qic/contracts";
import { Queue } from "bullmq";
import { queueBaseOptions } from "./options.js";

/**
 * Producer side of the email queue.
 *
 * 邮件队列的生产者。
 */
export interface EmailQueue {
  /** Validates and enqueues an email; resolves once Redis has accepted the job. 校验并投递邮件；Redis 接收后 resolve。 */
  enqueue: (job: SendEmailJob) => Promise<void>;
  /** The underlying queue, for dashboards such as Bull Board. 底层队列，供 Bull Board 等面板使用。 */
  readonly queue: Queue;
  /** Closes the Redis connection on shutdown. 停机时关闭连接。 */
  close: () => Promise<void>;
}

/**
 * Creates the email producer with the contract's retry policy.
 *
 * 创建邮件生产者，使用契约中定义的重试策略。
 *
 * @param redisUrl - Redis connection URL. Redis 连接串。
 */
export const createEmailQueue = (redisUrl: string): EmailQueue => {
  const queue = new Queue(EMAIL_QUEUE, {
    ...queueBaseOptions(redisUrl),
    defaultJobOptions: EMAIL_JOB_OPTIONS,
  });
  return {
    queue,
    enqueue: async (job) => {
      await queue.add(SEND_EMAIL_JOB, SendEmailJobSchema.parse(job));
    },
    close: () => queue.close(),
  };
};
