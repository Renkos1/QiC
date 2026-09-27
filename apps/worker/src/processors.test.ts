/*
 * Nest queue processors: routing to job handlers and dead-lettering failures. BullMQ
 * workers are not started.
 *
 * Nest 队列处理器：分发到任务处理函数，失败交给死信记录器。不启动真实的 BullMQ worker。
 */
import "reflect-metadata";
import { EMAIL_QUEUE, NOTIFICATIONS_QUEUE } from "@qic/contracts";
import type { Logger } from "@qic/logger";
import type { Mailer, MailMessage } from "@qic/mail";
import type { Job } from "bullmq";
import { describe, expect, it, vi } from "vitest";
import type { DeadLetterSink } from "./dead-letter.js";
import { EmailProcessor, NotificationsProcessor } from "./processors.js";

const logger = { info: vi.fn() } as unknown as Logger;

const setup = () => {
  const sent: MailMessage[] = [];
  const mailer: Mailer = {
    send: async (message) => {
      sent.push(message);
    },
    verify: async () => {},
    close: () => {},
  };
  const deadLetters: DeadLetterSink = { record: vi.fn() };
  return { sent, mailer, deadLetters, config: { concurrency: 3 } };
};

describe("queue processors", () => {
  it("should route email jobs to the send-email handler", async () => {
    const { sent, mailer, deadLetters, config } = setup();
    const processor = new EmailProcessor(mailer, logger, deadLetters, config);
    await processor.process({
      id: "1",
      attemptsMade: 0,
      data: { template: "verify-email", to: "a@example.com", name: "A", url: "http://x.test/v" },
    } as Job<unknown>);
    expect(sent[0]?.subject).toContain("验证");
  });

  it.each([
    [EmailProcessor, EMAIL_QUEUE],
    [NotificationsProcessor, NOTIFICATIONS_QUEUE],
  ])(
    "should report failures with the queue name to the dead-letter sink (%o)",
    (Processor, queue) => {
      const { mailer, deadLetters, config } = setup();
      const processor = new Processor(mailer, logger, deadLetters, config);
      const job = { id: "9" } as Job;
      const error = new Error("boom");
      processor.onFailed(job, error);
      expect(deadLetters.record).toHaveBeenCalledWith(queue, job, error);
    },
  );
});
