/*
 * Observability for the Node apps: OpenTelemetry bootstrap (traces, metrics, logs),
 * queue backlog metrics and Sentry error reporting. Everything is off until the matching
 * environment variables are set.
 *
 * Node 应用的可观测性：OpenTelemetry 启动（trace、指标、日志）、队列积压指标和 Sentry
 * 错误上报。在设置对应的环境变量之前全部处于关闭状态。
 */
export {
  createErrorReporter,
  type ErrorReporter,
  type ErrorReporterOptions,
  NOOP_ERROR_REPORTER,
} from "./errors.js";
export {
  BACKLOG_STATES,
  type CountableQueue,
  type JobState,
  observeQueueBacklog,
  QUEUE_JOBS_METRIC,
} from "./metrics.js";
export {
  defaultInstrumentations,
  getTelemetry,
  HOOKED_MODULES,
  startTelemetry,
  type Telemetry,
  type TelemetryOptions,
} from "./node.js";
