/*
 * The send-email job handler with an in-memory mailer.
 *
 * 发送邮件任务处理器（内存发信器）。
 */
import type { Logger } from "@qic/logger";
import type { Mailer, MailMessage } from "@qic/mail";
import { type Job, UnrecoverableError } from "bullmq";
import { describe, expect, it, vi } from "vitest";
import { createSendEmailProcessor } from "./send-email.js";

const fakeMailer = () => {
  const sent: MailMessage[] = [];
  const mailer: Mailer = {
    send: async (message) => {
      sent.push(message);
    },
    verify: async () => {},
    close: () => {},
  };
  return { mailer, sent };
};

const logger = { info: vi.fn() } as unknown as Logger;
const job = (data: unknown) => ({ id: "1", data, attemptsMade: 0 }) as Job<unknown>;

describe("createSendEmailProcessor", () => {
  it("should send the rendered template when the payload is valid", async () => {
    const { mailer, sent } = fakeMailer();
    const process = createSendEmailProcessor({ mailer, logger });

    await process(
      job({ template: "verify-email", to: "a@example.com", name: "A", url: "http://x.test/v" }),
    );

    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe("a@example.com");
    expect(sent[0]?.text).toContain("http://x.test/v");
  });

  it("should fail without retry when the payload is invalid", async () => {
    const { mailer, sent } = fakeMailer();
    const process = createSendEmailProcessor({ mailer, logger });

    await expect(process(job({ template: "unknown" }))).rejects.toBeInstanceOf(UnrecoverableError);
    expect(sent).toHaveLength(0);
  });

  it("should propagate the error when smtp fails so the job is retried", async () => {
    const mailer: Mailer = {
      send: async () => {
        throw new Error("ECONNREFUSED");
      },
      verify: async () => {},
      close: () => {},
    };
    const process = createSendEmailProcessor({ mailer, logger });

    await expect(
      process(
        job({ template: "reset-password", to: "a@example.com", name: "A", url: "http://x.test" }),
      ),
    ).rejects.toThrow("ECONNREFUSED");
  });
});
