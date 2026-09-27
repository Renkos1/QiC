import { createRequire } from "node:module";
import { isSpanContextValid, trace } from "@opentelemetry/api";
import { type Logger, pino } from "pino";

/** The pino logger type used across apps. 各应用共用的 pino 日志器类型。 */
export type { Logger } from "pino";

/**
 * Options of {@link createLogger}.
 *
 * {@link createLogger} 的选项。
 */
export interface CreateLoggerOptions {
  /** Logical service name, e.g. "api" or "worker". 服务名，如 "api"、"worker"。 */
  service: string;
  /** Deployment environment; defaults to `NODE_ENV`. 部署环境，默认取 `NODE_ENV`。 */
  env?: string;
  /** Release identifier; defaults to `RELEASE`. 版本标识，默认取 `RELEASE`。 */
  release?: string;
  /** Defaults to "info"; `debug` is opt-in via LOG_LEVEL. 默认 "info"，通过 `LOG_LEVEL` 开启 debug。 */
  level?: string;
  /** Human-readable output for local development. Never enable in production. 本地开发用的可读输出，生产禁用。 */
  pretty?: boolean;
}

/**
 * Paths whose values must never reach log storage (AGENTS.md §11).
 *
 * 值绝不能写入日志的字段路径（AGENTS.md §11），输出时替换为 `[REDACTED]`。
 */
export const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  'res.headers["set-cookie"]',
  "*.password",
  "*.newPassword",
  "*.token",
  "*.secret",
];

const require = createRequire(import.meta.url);

/**
 * Ids of the active OpenTelemetry span, added to every log line written inside a traced
 * request or job so Grafana can jump from a trace to its logs. Empty when tracing is off.
 *
 * 当前 OpenTelemetry span 的 id。在被追踪的请求或任务中写的每行日志都会带上，
 * 便于在 Grafana 中从 trace 跳到对应日志；未开启追踪时为空对象。
 */
export const traceFields = (): { traceId?: string; spanId?: string } => {
  const context = trace.getActiveSpan()?.spanContext();
  if (!context || !isSpanContextValid(context)) return {};
  return { traceId: context.traceId, spanId: context.spanId };
};

/**
 * Creates the process-wide structured logger. Every line carries the fixed
 * fields service/env/release, plus traceId/spanId inside a traced request or job,
 * so logs from all apps can be queried and correlated uniformly.
 *
 * 创建进程级的结构化日志器（pino）。每行都带 service/env/release 固定字段，
 * 在被追踪的请求或任务中还带 traceId/spanId，便于统一查询和关联所有应用的日志；
 * 敏感字段按 {@link REDACT_PATHS} 脱敏。
 *
 * @param options - Service identity, level and output format. 服务标识、级别和输出格式。
 */
export const createLogger = ({
  service,
  env = process.env.NODE_ENV ?? "development",
  release = process.env.RELEASE ?? "dev",
  level = "info",
  pretty = false,
}: CreateLoggerOptions): Logger =>
  pino({
    level,
    base: { service, env, release },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: { level: (label) => ({ level: label }) },
    mixin: traceFields,
    redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
    // Resolved here because pnpm does not expose pino-pretty to pino's own resolver.
    ...(pretty && { transport: { target: require.resolve("pino-pretty") } }),
  });

export { createNestLogger, type NestLoggerAdapter } from "./nest.js";
