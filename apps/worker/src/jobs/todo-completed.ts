import { TodoCompletedJobSchema } from "@qic/contracts";
import type { Logger } from "@qic/logger";
import { type Mailer, renderTodoCompleted } from "@qic/mail";
import { type Job, UnrecoverableError } from "bullmq";

/** Dependencies of {@link createTodoCompletedProcessor}. 完成通知处理器的依赖。 */
export interface TodoCompletedDeps {
  mailer: Mailer;
  logger: Logger;
}

/**
 * Emails the user when a todo is completed. Invalid payloads are not retried.
 *
 * 待办完成时给用户发通知邮件。负载无效时不重试。
 *
 * @param deps - Mailer and logger. 发信器和日志器。
 * @returns A BullMQ job handler. BullMQ 任务处理函数。
 */
export const createTodoCompletedProcessor =
  ({ mailer, logger }: TodoCompletedDeps) =>
  async (job: Job<unknown>): Promise<void> => {
    const parsed = TodoCompletedJobSchema.safeParse(job.data);
    if (!parsed.success) {
      throw new UnrecoverableError(`Invalid todo-completed payload: ${parsed.error.message}`);
    }
    const { to, name, title, url, todoId } = parsed.data;
    await mailer.send({ to, ...renderTodoCompleted({ name, title, url }) });
    logger.info({ jobId: job.id, todoId, attempt: job.attemptsMade + 1 }, "todo-completed sent");
  };
