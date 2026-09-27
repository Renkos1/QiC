/// <reference path="./import-in-the-middle.d.ts" />
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import type { Instrumentation } from "@opentelemetry/instrumentation";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { IORedisInstrumentation } from "@opentelemetry/instrumentation-ioredis";
import { NestInstrumentation } from "@opentelemetry/instrumentation-nestjs-core";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { PinoInstrumentation } from "@opentelemetry/instrumentation-pino";
import { RuntimeNodeInstrumentation } from "@opentelemetry/instrumentation-runtime-node";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { BatchSpanProcessor, type SpanProcessor } from "@opentelemetry/sdk-trace-base";
import { ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { register as registerModuleHooks } from "import-in-the-middle/register-hooks.mjs";

/**
 * Packages imported from ESM whose instrumentation needs the import-in-the-middle hook.
 * Keep in sync with {@link defaultInstrumentations}; an unlisted package is silently not traced.
 *
 * 通过 ESM 导入、需要 import-in-the-middle 钩子才能插桩的包。与 {@link defaultInstrumentations}
 * 保持一致；漏列的包不会报错，只是不产生 span。
 */
export const HOOKED_MODULES = ["express", "@nestjs/core", "pg", "ioredis", "pino"];

/** Paths polled by health checks; tracing them only adds noise. 健康检查路径，不产生 trace。 */
const UNTRACED_PATHS = new Set(["/healthz", "/readyz"]);

/**
 * Instrumentations shared by the Node apps: HTTP server/client, Express and Nest routing,
 * Postgres (queries and pool metrics), Redis, pino (log export) and runtime metrics
 * (event loop delay, GC, heap).
 *
 * 各 Node 应用共用的插桩：HTTP 收发、Express 与 Nest 路由、Postgres（查询与连接池指标）、
 * Redis、pino（日志导出）以及运行时指标（事件循环延迟、GC、堆）。
 */
export const defaultInstrumentations = (): Instrumentation[] => [
  new HttpInstrumentation({
    ignoreIncomingRequestHook: (request) => UNTRACED_PATHS.has(request.url ?? ""),
  }),
  new ExpressInstrumentation(),
  new NestInstrumentation(),
  new PgInstrumentation({ ignoreConnectSpans: true }),
  // BullMQ polls Redis continuously; only trace commands issued inside a request or job.
  new IORedisInstrumentation({ requireParentSpan: true }),
  // Trace ids are added by @qic/logger itself; here pino only feeds the OTel log pipeline.
  new PinoInstrumentation({ disableLogCorrelation: true }),
  new RuntimeNodeInstrumentation(),
];

/**
 * Options of {@link startTelemetry}.
 *
 * {@link startTelemetry} 的选项。
 */
export interface TelemetryOptions {
  /** `service.name` of every signal, e.g. "api". 所有信号的 `service.name`，如 "api"。 */
  service: string;
  /** Environment to read; defaults to `process.env`. 读取的环境变量，默认 `process.env`。 */
  env?: NodeJS.ProcessEnv;
  /** Replaces {@link defaultInstrumentations}. 替换默认插桩列表。 */
  instrumentations?: Instrumentation[];
}

/**
 * Handle of the started (or skipped) SDK.
 *
 * 已启动（或被跳过）的 SDK 句柄。
 */
export interface Telemetry {
  /** Destinations in use, e.g. ["otlp", "langfuse"]; empty when disabled. 正在使用的导出目标，禁用时为空。 */
  exporters: string[];
  /** Flushes buffered signals and stops the SDK. 刷出缓冲中的数据并停止 SDK。 */
  shutdown: () => Promise<void>;
}

const DISABLED: Telemetry = { exporters: [], shutdown: async () => {} };

let current: Telemetry = DISABLED;

/**
 * Starts OpenTelemetry for a Node app. Export targets come only from the environment:
 * `OTEL_EXPORTER_OTLP_*` sends traces, metrics and logs over OTLP/HTTP; `LANGFUSE_PUBLIC_KEY`
 * plus `LANGFUSE_SECRET_KEY` additionally send GenAI spans to Langfuse. With neither set
 * this does nothing, so there is no overhead in local development or CI.
 *
 * Call it from an entry loaded with `node --import` so the module hooks are installed
 * before the app imports the instrumented packages.
 *
 * 启动 Node 应用的 OpenTelemetry。导出目标只由环境变量决定：设置 `OTEL_EXPORTER_OTLP_*`
 * 时通过 OTLP/HTTP 发送 trace、指标和日志；同时设置 `LANGFUSE_PUBLIC_KEY` 与
 * `LANGFUSE_SECRET_KEY` 时额外把 GenAI span 发送到 Langfuse。都未设置时什么也不做，
 * 本地开发和 CI 没有额外开销。
 *
 * 必须在通过 `node --import` 加载的入口中调用，确保模块钩子在应用导入被插桩的包之前安装。
 *
 * @param options - Service name, environment and instrumentations. 服务名、环境变量和插桩列表。
 * @returns The handle, also available later through {@link getTelemetry}. 句柄，之后也可通过 {@link getTelemetry} 获取。
 */
export const startTelemetry = ({
  service,
  env = process.env,
  instrumentations = defaultInstrumentations(),
}: TelemetryOptions): Telemetry => {
  const otlp = Boolean(env.OTEL_EXPORTER_OTLP_ENDPOINT);
  const langfuse = Boolean(env.LANGFUSE_PUBLIC_KEY && env.LANGFUSE_SECRET_KEY);
  if (!otlp && !langfuse) return DISABLED;

  registerModuleHooks({ include: HOOKED_MODULES });

  const spanProcessors: SpanProcessor[] = [];
  // Exporters read the endpoint, headers and protocol options from OTEL_EXPORTER_OTLP_*.
  if (otlp) spanProcessors.push(new BatchSpanProcessor(new OTLPTraceExporter()));
  if (langfuse) spanProcessors.push(new LangfuseSpanProcessor());

  const sdk = new NodeSDK({
    serviceName: service,
    resource: resourceFromAttributes({
      [ATTR_SERVICE_VERSION]: env.RELEASE ?? env.GIT_SHA ?? "dev",
      "deployment.environment.name": env.NODE_ENV ?? "development",
    }),
    spanProcessors,
    ...(otlp && {
      metricReaders: [new PeriodicExportingMetricReader({ exporter: new OTLPMetricExporter() })],
      logRecordProcessors: [new BatchLogRecordProcessor({ exporter: new OTLPLogExporter() })],
    }),
    instrumentations,
  });
  sdk.start();

  current = {
    exporters: [...(otlp ? ["otlp"] : []), ...(langfuse ? ["langfuse"] : [])],
    shutdown: () => sdk.shutdown(),
  };
  return current;
};

/**
 * Returns the handle created by {@link startTelemetry}, or a disabled one if it was not
 * started. Lets the app entry flush telemetry on shutdown without importing the hook entry.
 *
 * 返回 {@link startTelemetry} 创建的句柄；未启动时返回禁用句柄。
 * 应用入口借此在停机时刷出数据，而无需再次导入钩子入口。
 */
export const getTelemetry = (): Telemetry => current;
