/*
 * The /otlp relay that forwards browser spans to the collector. The upstream fetch is a
 * fake; no collector is needed.
 *
 * 把浏览器 span 转发给采集器的 /otlp 中转。上游 fetch 为假实现，不需要真实采集器。
 */
import { describe, expect, it, vi } from "vitest";
import { MAX_RELAY_BYTES, relayTraces, tracesEndpoint } from "./otlp-relay";

const exportRequest = (body: string, type = "application/json") =>
  new Request("http://localhost/otlp/v1/traces", {
    method: "POST",
    headers: { "content-type": type },
    body,
  });

const env = (vars: Record<string, string>) => vars as NodeJS.ProcessEnv;

describe("tracesEndpoint", () => {
  it("should append /v1/traces to the base endpoint", () => {
    expect(tracesEndpoint(env({ OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel:4318/" }))).toBe(
      "http://otel:4318/v1/traces",
    );
  });

  it("should prefer the traces-specific endpoint", () => {
    expect(
      tracesEndpoint(
        env({
          OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel:4318",
          OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "http://traces:4318/custom",
        }),
      ),
    ).toBe("http://traces:4318/custom");
  });

  it("should be null when no collector is configured", () => {
    expect(tracesEndpoint(env({}))).toBeNull();
  });
});

describe("relayTraces", () => {
  it("should forward the batch with its content type", async () => {
    const send = vi.fn(async () => new Response(null, { status: 200 }));
    const response = await relayTraces(
      exportRequest('{"resourceSpans":[]}'),
      "http://otel/v1/traces",
      send,
    );
    expect(response.status).toBe(200);
    expect(send).toHaveBeenCalledWith(
      "http://otel/v1/traces",
      expect.objectContaining({ method: "POST", headers: { "content-type": "application/json" } }),
    );
  });

  it("should accept and drop the batch when no collector is configured", async () => {
    const send = vi.fn();
    const response = await relayTraces(exportRequest("{}"), null, send);
    expect(response.status).toBe(204);
    expect(send).not.toHaveBeenCalled();
  });

  it("should reject content that is not OTLP", async () => {
    const response = await relayTraces(exportRequest("hi", "text/plain"), "http://otel", vi.fn());
    expect(response.status).toBe(415);
  });

  it("should reject batches over the size limit", async () => {
    const send = vi.fn();
    const response = await relayTraces(
      exportRequest("x".repeat(MAX_RELAY_BYTES + 1)),
      "http://otel",
      send,
    );
    expect(response.status).toBe(413);
    expect(send).not.toHaveBeenCalled();
  });

  it("should not surface collector failures to the browser", async () => {
    const send = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    const response = await relayTraces(exportRequest("{}"), "http://otel", send);
    expect(response.status).toBe(202);
  });
});
