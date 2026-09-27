import { SendEmailJobSchema } from "@qic/contracts";
import type { Logger } from "@qic/logger";
import { type Mailer, type RenderedEmail, renderResetPassword, renderVerifyEmail } from "@qic/mail";
import { type Job, UnrecoverableError } from "bullmq";

const renderers = {
  "verify-email": renderVerifyEmail,
  "reset-password": renderResetPassword,
} satisfies Record<string, (input: { name: string; url: string }) => RenderedEmail>;

/** Dependencies of {@link createSendEmailProcessor}. 邮件处理器的依赖。 */
export interface SendEmailDeps {
  mailer: Mailer;
  logger: Logger;
}

/**
 * Processes `send-email` jobs. A payload that fails validation can never succeed,
 * so it is failed immediately instead of burning retries; SMTP errors are thrown
 * as-is and retried with the job's backoff policy.
 *
 * 处理 `send-email` 任务。负载校验失败的任务永远不会成功，立即以不可恢复错误结束，不浪费重试；
 * SMTP 错误原样抛出，按任务的退避策略重试。日志不记录收件人地址（个人信息）。
 *
 * @param deps - Mailer and logger. 发信器和日志器。
 * @returns A BullMQ job handler. BullMQ 任务处理函数。
 */
export const createSendEmailProcessor =
  ({ mailer, logger }: SendEmailDeps) =>
  async (job: Job<unknown>): Promise<void> => {
    const parsed = SendEmailJobSchema.safeParse(job.data);
    if (!parsed.success) {
      throw new UnrecoverableError(`Invalid send-email payload: ${parsed.error.message}`);
    }
    const { template, to, name, url } = parsed.data;
    const email = renderers[template]({ name, url });
    await mailer.send({ to, ...email });
    // Recipient address is personal data; log the template and job id only.
    logger.info({ jobId: job.id, template, attempt: job.attemptsMade + 1 }, "email sent");
  };
