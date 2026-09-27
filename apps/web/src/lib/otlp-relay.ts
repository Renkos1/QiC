/** Largest span batch accepted from a browser. 接受的单批浏览器 span 最大体积。 */
export const MAX_RELAY_BYTES = 512 * 1024;

const ACCEPTED_TYPES = ["application/json", "application/x-protobuf"];

/**
 * Where browser spans go: `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` as is, or
 * `OTEL_EXPORTER_OTLP_ENDPOINT` + `/v1/traces` (the OTLP convention). Null when unset.
 *
 * 浏览器 span 的去向：直接使用 `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`，或按 OTLP 约定在
 * `OTEL_EXPORTER_OTLP_ENDPOINT` 后加 `/v1/traces`。均未设置时为 null。
 *
 * @param env - Variables to read. 读取的环境变量。
 */
export const tracesEndpoint = (env: NodeJS.ProcessEnv = process.env): string | null => {
  if (env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT) return env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
  if (env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    return `${env.OTEL_EXPORTER_OTLP_ENDPOINT.replace(/\/$/, "")}/v1/traces`;
  }
  return null;
};

/**
 * Forwards an OTLP trace export from the browser to the collector, so the collector
 * never has to be reachable from the internet. Unconfigured, it accepts and drops the
 * batch (204) so browsers do not retry. Only OTLP content types under
 * {@link MAX_RELAY_BYTES} are forwarded.
 *
 * 把浏览器发来的 OTLP trace 数据转发给采集器，采集器因此无需暴露到公网。
 * 未配置采集器时接收并丢弃（204），避免浏览器重试。只转发 OTLP 内容类型、
 * 且不超过 {@link MAX_RELAY_BYTES} 的请求。
 *
 * @param request - The browser's export request. 浏览器的导出请求。
 * @param endpoint - Collector traces URL, or null to drop. 采集器的 traces 地址；为 null 时丢弃。
 * @param send - Fetch implementation (injectable for tests). fetch 实现（便于测试注入）。
 */
export const relayTraces = async (
  request: Request,
  endpoint: string | null,
  send: typeof fetch = fetch,
): Promise<Response> => {
  const type = request.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  if (!ACCEPTED_TYPES.includes(type)) return new Response(null, { status: 415 });
  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_RELAY_BYTES) return new Response(null, { status: 413 });
  if (!endpoint) return new Response(null, { status: 204 });
  const upstream = await send(endpoint, {
    method: "POST",
    headers: { "content-type": type },
    body,
  }).catch(() => null);
  // Telemetry is best effort: never surface collector problems to the page.
  return new Response(null, { status: upstream?.ok ? 200 : 202 });
};
