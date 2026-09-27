/*
 * The todo-completed job handler with an in-memory mailer, including HTML escaping.
 *
 * 待办完成通知处理器（内存发信器），包括 HTML 转义。
 */
import type { Logger } from "@qic/logger";
import type { Mailer, MailMessage } from "@qic/mail";
import { type Job, UnrecoverableError } from "bullmq";
import { describe, expect, it, vi } from "vitest";
import { createTodoCompletedProcessor } from "./todo-completed.js";

const logger = { info: vi.fn() } as unknown as Logger;
const job = (data: unknown) => ({ id: "7", data, attemptsMade: 0 }) as Job<unknown>;
const valid = {
  todoId: "0b8a3f5e-6c1d-4a8e-9f3b-2d7c1e5a9b40",
  userId: "u1",
  title: "<b>买牛奶</b>",
  to: "a@example.com",
  name: "A",
  url: "http://localhost:13000/examples/todos",
};

const recordingMailer = () => {
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

describe("createTodoCompletedProcessor", () => {
  it("should email the owner with the title and a link back to the list", async () => {
    const { mailer, sent } = recordingMailer();
    await createTodoCompletedProcessor({ mailer, logger })(job(valid));
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe("a@example.com");
    expect(sent[0]?.subject).toContain("买牛奶");
    expect(sent[0]?.text).toContain(valid.url);
    // The title is user input: it must be escaped in the HTML part.
    expect(sent[0]?.html).not.toContain("<b>买牛奶</b>");
  });

  it("should fail without retry when the payload is invalid", async () => {
    const { mailer, sent } = recordingMailer();
    await expect(
      createTodoCompletedProcessor({ mailer, logger })(job({ ...valid, to: "nope" })),
    ).rejects.toBeInstanceOf(UnrecoverableError);
    expect(sent).toHaveLength(0);
  });

  it("should propagate SMTP errors so the job is retried", async () => {
    const mailer: Mailer = {
      send: async () => {
        throw new Error("ECONNRESET");
      },
      verify: async () => {},
      close: () => {},
    };
    await expect(createTodoCompletedProcessor({ mailer, logger })(job(valid))).rejects.toThrow(
      "ECONNRESET",
    );
  });
});
