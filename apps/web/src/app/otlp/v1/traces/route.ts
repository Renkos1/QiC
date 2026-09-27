import { relayTraces, tracesEndpoint } from "@/lib/otlp-relay";

/**
 * Reads the collector address at request time, so one image serves every environment.
 *
 * 在请求时读取采集器地址，同一个镜像可用于所有环境。
 */
export const dynamic = "force-dynamic";

/**
 * `POST /otlp/v1/traces`: relay for browser spans (see src/instrumentation-client.ts).
 *
 * `POST /otlp/v1/traces`：浏览器 span 的中转接口（见 src/instrumentation-client.ts）。
 */
export const POST = (request: Request) => relayTraces(request, tracesEndpoint());
