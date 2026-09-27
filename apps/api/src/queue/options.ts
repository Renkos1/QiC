import { BullMQOtel } from "bullmq-otel";

/**
 * Connection and telemetry shared by every producer. With telemetry, `add()` creates a
 * producer span and stores its context in the job, so the worker continues the same trace
 * (a no-op while OpenTelemetry is off).
 *
 * 所有生产者共用的连接与遥测配置。开启遥测后，`add()` 会创建生产者 span 并把上下文写入任务，
 * worker 处理时延续同一条 trace（OpenTelemetry 关闭时为空操作）。
 *
 * @param redisUrl - Redis connection URL. Redis 连接串。
 */
export const queueBaseOptions = (redisUrl: string) => ({
  connection: { url: redisUrl },
  telemetry: new BullMQOtel({ tracerName: "bullmq", enableMetrics: true }),
});
