/*
 * Preloaded with `node --import` before src/main.ts so OpenTelemetry can hook the
 * instrumented packages (http, express, Nest, pg, ioredis, pino) before they are imported.
 * Does nothing unless OTEL_EXPORTER_OTLP_ENDPOINT or LANGFUSE_* is set.
 *
 * 通过 `node --import` 在 src/main.ts 之前预加载，让 OpenTelemetry 在被插桩的包
 * （http、express、Nest、pg、ioredis、pino）被导入之前挂好钩子。
 * 未设置 OTEL_EXPORTER_OTLP_ENDPOINT 或 LANGFUSE_* 时不做任何事。
 */
import { startTelemetry } from "@qic/telemetry";

startTelemetry({ service: "worker" });
