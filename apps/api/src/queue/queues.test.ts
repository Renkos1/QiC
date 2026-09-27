/*
 * Queue producers with BullMQ faked: payload validation, the contract's retry policy and
 * trace propagation.
 *
 * 队列生产者测试（替换 BullMQ）：负载校验、契约中的重试策略与 trace 传递配置。
 */
import {
  EMAIL_JOB_OPTIONS,
  EMAIL_QUEUE,
  NOTIFICATION_JOB_OPTIONS,
  NOTIFICATIONS_QUEUE,
} from "@qic/contracts";
import { BullMQOtel } from "bullmq-otel";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmailQueue } from "./email.js";
import { createNotificationQueue } from "./notifications.js";

// BullMQ is the boundary to Redis; record what would be enqueued.
const queues = vi.hoisted(
  () => [] as { name: string; options: unknown; add: ReturnType<typeof vi.fn> }[],
);
vi.mock("bullmq", () => ({
  Queue: class {
    add = vi.fn(async () => undefined);
    close = vi.fn(async () => undefined);
    constructor(name: string, options: unknown) {
      queues.push({ name, options, add: this.add });
    }
  },
}));

beforeEach(() => {
  queues.length = 0;
});

describe("email queue", () => {
  it("should enqueue a valid email with the contract's retry policy", async () => {
    const queue = createEmailQueue("redis://localhost:16379");
    const job = {
      template: "verify-email",
      to: "a@example.com",
      name: "A",
      url: "http://x.test/v",
    } as const;
    await queue.enqueue(job);
    const [created] = queues;
    expect(created?.name).toBe(EMAIL_QUEUE);
    expect(created?.options).toMatchObject({
      defaultJobOptions: EMAIL_JOB_OPTIONS,
      // Carries the trace context from the request into the job.
      telemetry: expect.any(BullMQOtel),
    });
    expect(created?.add).toHaveBeenCalledWith("send-email", job);
  });

  it("should reject an invalid payload without enqueueing it", async () => {
    const queue = createEmailQueue("redis://localhost:16379");
    await expect(
      queue.enqueue({ template: "verify-email", to: "not-an-email", name: "A", url: "x" }),
    ).rejects.toThrow();
    expect(queues[0]?.add).not.toHaveBeenCalled();
  });
});

describe("notification queue", () => {
  const job = {
    todoId: "0b8a3f5e-6c1d-4a8e-9f3b-2d7c1e5a9b40",
    userId: "u1",
    title: "milk",
    to: "a@example.com",
    name: "A",
    url: "http://localhost:13000/examples/todos",
  };

  it("should enqueue a todo-completed job with the contract's retry policy", async () => {
    await createNotificationQueue("redis://localhost:16379").todoCompleted(job);
    const [created] = queues;
    expect(created?.name).toBe(NOTIFICATIONS_QUEUE);
    expect(created?.options).toMatchObject({ defaultJobOptions: NOTIFICATION_JOB_OPTIONS });
    expect(created?.add).toHaveBeenCalledWith("todo-completed", job);
  });

  it("should reject a payload whose todo id is not a UUID", async () => {
    const queue = createNotificationQueue("redis://localhost:16379");
    await expect(queue.todoCompleted({ ...job, todoId: "1" })).rejects.toThrow();
    expect(queues[0]?.add).not.toHaveBeenCalled();
  });
});
