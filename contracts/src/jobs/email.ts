import { z } from "zod";

/**
 * BullMQ queue carrying outgoing email. Producer: api. Consumer: worker.
 *
 * 发送邮件的 BullMQ 队列。生产者：api；消费者：worker。
 */
export const EMAIL_QUEUE = "email";

/**
 * Job name for {@link SendEmailJobSchema} payloads.
 *
 * {@link SendEmailJobSchema} 负载对应的任务名。
 */
export const SEND_EMAIL_JOB = "send-email";

const ActionEmailFields = {
  to: z.email(),
  name: z.string().min(1),
  url: z.url(),
};

/**
 * Payload of a `send-email` job. The template is chosen by the worker, so the api
 * never renders or sends mail inside a request.
 *
 * `send-email` 任务的负载。由 worker 选择模板渲染，API 在请求中从不渲染或发送邮件。
 * `url` 是用户需要点击的链接（验证邮箱、重置密码）。
 */
export const SendEmailJobSchema = z.discriminatedUnion("template", [
  z.object({ template: z.literal("verify-email"), ...ActionEmailFields }),
  z.object({ template: z.literal("reset-password"), ...ActionEmailFields }),
]);

/** Payload of a `send-email` job. 发送邮件任务的负载。 */
export type SendEmailJob = z.infer<typeof SendEmailJobSchema>;

/**
 * Default retry policy for email jobs: 5 attempts with exponential backoff
 * (1s, 2s, 4s, 8s). Producers pass this so behaviour is uniform.
 *
 * 邮件任务的默认重试策略：最多 5 次，指数退避（1、2、4、8 秒）。
 * 成功记录保留 1 天，失败记录保留 7 天；最终失败的任务另由 worker 转入死信队列。
 */
export const EMAIL_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: "exponential", delay: 1_000 },
  removeOnComplete: { age: 24 * 60 * 60, count: 1_000 },
  removeOnFail: { age: 7 * 24 * 60 * 60 },
} as const;
