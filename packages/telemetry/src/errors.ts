import { trace } from "@opentelemetry/api";
import type { Logger } from "@qic/logger";
import * as Sentry from "@sentry/node";

/**
 * Where unexpected errors go. Only report errors a developer has to look at (5xx, jobs that
 * exhausted their retries); expected failures are answered or retried, not reported.
 *
 * 意外错误的上报出口。只上报需要开发者处理的错误（5xx、重试耗尽的任务）；
 * 预期内的失败直接返回或重试，不上报。
 */
export interface ErrorReporter {
  /** Whether reports leave the process. 上报是否真正发出。 */
  readonly enabled: boolean;
  /**
   * Reports an error with optional context. Never throws.
   *
   * 上报一个错误，可附带上下文；不会抛出异常。
   *
   * @param error - The error to report. 要上报的错误。
   * @param context - Extra fields such as queue and job id; no personal data. 额外字段（如队列、任务 id），不含个人数据。
   */
  capture: (error: unknown, context?: Record<string, unknown>) => void;
  /** Waits for queued reports to be sent; call on shutdown. 等待已排队的上报发送完成，停机时调用。 */
  flush: (timeoutMs?: number) => Promise<void>;
}

/**
 * Options of {@link createErrorReporter}.
 *
 * {@link createErrorReporter} 的选项。
 */
export interface ErrorReporterOptions {
  /** Tag added to every event, e.g. "api". 每个事件都带的服务标签，如 "api"。 */
  service: string;
  /** `SENTRY_DSN`; reporting is disabled when unset. 未设置时禁用上报。 */
  dsn: string | undefined;
  /** Release shown in Sentry; must match the uploaded source maps. Sentry 中的版本，需与上传的 source map 一致。 */
  release: string;
  /** Deployment environment. 部署环境。 */
  environment: string;
  /** Receives the enabled/disabled notice. 接收启用/禁用提示。 */
  logger: Pick<Logger, "info">;
}

/** Reporter that drops everything; the default when Sentry is not configured and in tests. 丢弃一切的上报器，未配置 Sentry 时及测试中使用。 */
export const NOOP_ERROR_REPORTER: ErrorReporter = {
  enabled: false,
  capture: () => {},
  flush: async () => {},
};

/**
 * Creates the error reporter backed by Sentry, or a no-op one when `SENTRY_DSN` is unset.
 * Sentry only handles errors here: tracing stays in OpenTelemetry, and each event carries
 * the active `traceId` tag so it can be matched with the trace in Grafana.
 *
 * 创建基于 Sentry 的错误上报器；`SENTRY_DSN` 未设置时返回空实现并在日志中说明。
 * 这里的 Sentry 只负责错误：链路追踪仍由 OpenTelemetry 负责，每个事件都带当前的
 * `traceId` 标签，便于在 Grafana 中找到对应的 trace。
 *
 * @param options - DSN, identity and logger. DSN、服务标识和日志器。
 */
export const createErrorReporter = ({
  service,
  dsn,
  release,
  environment,
  logger,
}: ErrorReporterOptions): ErrorReporter => {
  if (!dsn) {
    logger.info("SENTRY_DSN not set; error reporting disabled");
    return NOOP_ERROR_REPORTER;
  }
  Sentry.init({
    dsn,
    release,
    environment,
    initialScope: { tags: { service } },
    // Events must not carry credentials or personal data (AGENTS.md §11).
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    // Errors only: leave module hooks and tracing to OpenTelemetry.
    enableRuntimeChannelInjection: false,
  });
  logger.info({ release }, "error reporting enabled (Sentry)");
  return {
    enabled: true,
    capture: (error, context) => {
      const traceId = trace.getActiveSpan()?.spanContext().traceId;
      Sentry.captureException(error, {
        ...(traceId && { tags: { traceId } }),
        ...(context && { extra: context }),
      });
    },
    flush: async (timeoutMs = 2_000) => {
      await Sentry.flush(timeoutMs);
    },
  };
};
