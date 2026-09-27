/*
 * Queue backlog gauge. Queues are fakes with canned job counts; metrics go to an
 * in-memory OTel reader. No Redis.
 *
 * 队列积压指标。队列为返回固定计数的假实现，指标写入内存中的 OTel reader；不需要 Redis。
 */
import { MeterProvider, MetricReader } from "@opentelemetry/sdk-metrics";
import { describe, expect, it } from "vitest";
import { type CountableQueue, observeQueueBacklog, QUEUE_JOBS_METRIC } from "./metrics.js";

class TestReader extends MetricReader {
  protected async onForceFlush() {}
  protected async onShutdown() {}
}

const queue = (name: string, counts: Record<string, number> | Error): CountableQueue => ({
  name,
  getJobCounts: async () => {
    if (counts instanceof Error) throw counts;
    return counts;
  },
});

const setup = (queues: CountableQueue[]) => {
  const reader = new TestReader();
  const meter = new MeterProvider({ readers: [reader] }).getMeter("test");
  const stop = observeQueueBacklog(queues, meter);
  const collect = async () => {
    const { resourceMetrics } = await reader.collect();
    const metric = resourceMetrics.scopeMetrics
      .flatMap((scope) => scope.metrics)
      .find((m) => m.descriptor.name === QUEUE_JOBS_METRIC);
    return (metric?.dataPoints ?? []).map((point) => ({
      queue: point.attributes["messaging.destination.name"],
      state: point.attributes.state,
      value: point.value,
    }));
  };
  return { collect, stop };
};

describe("observeQueueBacklog", () => {
  it("should report every state of every queue, defaulting missing counts to zero", async () => {
    const { collect } = setup([queue("email", { waiting: 3, active: 1, failed: 2 })]);
    const points = await collect();
    expect(points).toContainEqual({ queue: "email", state: "waiting", value: 3 });
    expect(points).toContainEqual({ queue: "email", state: "delayed", value: 0 });
    expect(points).toHaveLength(5);
  });

  it("should skip a queue that cannot be read and still report the others", async () => {
    const { collect } = setup([
      queue("broken", new Error("ECONNREFUSED")),
      queue("email", { waiting: 1 }),
    ]);
    const points = await collect();
    expect(points.every((point) => point.queue === "email")).toBe(true);
    expect(points).toHaveLength(5);
  });

  it("should stop reporting once stopped", async () => {
    const { collect, stop } = setup([queue("email", { waiting: 1 })]);
    stop();
    expect(await collect()).toEqual([]);
  });
});
