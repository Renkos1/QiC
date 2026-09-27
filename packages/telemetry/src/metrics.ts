import { type Meter, metrics, type ObservableResult } from "@opentelemetry/api";

/**
 * The part of a BullMQ `Queue` needed to measure its backlog.
 *
 * 统计积压所需的 BullMQ `Queue` 最小接口。
 */
export interface CountableQueue {
  readonly name: string;
  getJobCounts: (...states: JobState[]) => Promise<Record<string, number>>;
}

/** Job states reported by {@link observeQueueBacklog}. 统计的任务状态。 */
export type JobState = "waiting" | "prioritized" | "delayed" | "active" | "failed";

/** States counted on every collection. 每次采集统计的状态。 */
export const BACKLOG_STATES: JobState[] = ["waiting", "prioritized", "delayed", "active", "failed"];

/** Name of the backlog gauge (Prometheus: `qic_queue_jobs`). 积压指标名（Prometheus 中为 `qic_queue_jobs`）。 */
export const QUEUE_JOBS_METRIC = "qic.queue.jobs";

/**
 * Publishes the number of jobs per queue and state as the gauge {@link QUEUE_JOBS_METRIC},
 * read from Redis on each metric collection. A queue that cannot be read is skipped for
 * that round rather than failing the whole export.
 *
 * 以仪表 {@link QUEUE_JOBS_METRIC} 发布每个队列、每种状态的任务数；每次指标采集时从 Redis 读取。
 * 读取失败的队列本轮跳过，不影响其他指标的导出。
 *
 * @param queues - Queues to observe. 要观测的队列。
 * @param meter - Defaults to the global meter (a no-op when telemetry is off). 默认用全局 meter（遥测关闭时为空实现）。
 * @returns Stops observing. 停止观测的函数。
 */
export const observeQueueBacklog = (
  queues: CountableQueue[],
  meter: Meter = metrics.getMeter("@qic/telemetry"),
): (() => void) => {
  const gauge = meter.createObservableGauge(QUEUE_JOBS_METRIC, {
    description: "Jobs per queue and state",
    unit: "{job}",
  });
  const collect = async (result: ObservableResult) => {
    await Promise.all(
      queues.map(async (queue) => {
        const counts = await queue.getJobCounts(...BACKLOG_STATES).catch(() => null);
        if (!counts) return;
        for (const state of BACKLOG_STATES) {
          result.observe(counts[state] ?? 0, { "messaging.destination.name": queue.name, state });
        }
      }),
    );
  };
  gauge.addCallback(collect);
  return () => gauge.removeCallback(collect);
};
