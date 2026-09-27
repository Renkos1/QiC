/*
 * Lifecycle of the queue backlog metrics provider. observeQueueBacklog is mocked; the
 * queues are plain objects. No Redis.
 *
 * 队列积压指标 provider 的生命周期。observeQueueBacklog 被模拟，队列为普通对象；不需要 Redis。
 */
import { observeQueueBacklog } from "@qic/telemetry";
import type { Queue } from "bullmq";
import { describe, expect, it, vi } from "vitest";
import { QueueMetrics } from "./queue-metrics.js";

const stop = vi.fn();
vi.mock("@qic/telemetry", () => ({ observeQueueBacklog: vi.fn(() => stop) }));

const queue = (name: string) => ({ name }) as Queue;

describe("QueueMetrics", () => {
  it("should observe every queue, dead letters included, once the app has started", () => {
    const provider = new QueueMetrics(queue("email"), queue("notifications"), queue("dead-letter"));
    expect(observeQueueBacklog).not.toHaveBeenCalled();
    provider.onApplicationBootstrap();
    const observed = vi.mocked(observeQueueBacklog).mock.calls[0]?.[0] ?? [];
    expect(observed.map((q) => q.name)).toEqual(["email", "notifications", "dead-letter"]);
  });

  it("should stop observing when the module is destroyed", () => {
    const provider = new QueueMetrics(queue("email"), queue("notifications"), queue("dead-letter"));
    provider.onApplicationBootstrap();
    provider.onModuleDestroy();
    expect(stop).toHaveBeenCalled();
  });
});
