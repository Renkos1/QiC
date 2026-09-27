import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchSpanProcessor, WebTracerProvider } from "@opentelemetry/sdk-trace-web";

/** Same-origin relay that forwards browser spans to the collector. 同源中转路径，把浏览器 span 转发给采集器。 */
export const OTLP_RELAY_PATH = "/otlp/v1/traces";

/**
 * Traces the browser's fetch calls. Same-origin requests (the `/api` routes) carry a
 * `traceparent` header, so each api trace starts at the user's click.
 *
 * 追踪浏览器发出的 fetch 请求。同源请求（`/api` 路由）会携带 `traceparent` 头，
 * 因此 api 的每条 trace 都从用户的操作开始。
 */
export const startBrowserTracing = () => {
  const provider = new WebTracerProvider({
    resource: resourceFromAttributes({ "service.name": "web-browser" }),
    spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({ url: OTLP_RELAY_PATH }))],
  });
  provider.register();
  registerInstrumentations({
    tracerProvider: provider,
    // Never trace the exporter's own requests.
    instrumentations: [new FetchInstrumentation({ ignoreUrls: [/\/otlp\//] })],
  });
};
