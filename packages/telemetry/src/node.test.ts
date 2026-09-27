/*
 * The on/off switch of startTelemetry: which environment variables enable which exporters.
 * The OTel NodeSDK and the module hook are mocked, so no SDK starts and nothing is exported.
 *
 * startTelemetry 的开关逻辑：哪些环境变量启用哪些导出目标。OTel NodeSDK 与模块钩子
 * 均被模拟，不会真正启动 SDK，也不会导出任何数据。
 */
import { NodeSDK } from "@opentelemetry/sdk-node";
import { register } from "import-in-the-middle/register-hooks.mjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getTelemetry, HOOKED_MODULES, startTelemetry } from "./node.js";

vi.mock("import-in-the-middle/register-hooks.mjs", () => ({ register: vi.fn() }));
vi.mock("@opentelemetry/sdk-node", () => ({
  NodeSDK: vi.fn(
    class {
      start = vi.fn();
      shutdown = vi.fn(async () => {});
    },
  ),
}));

const config = () => vi.mocked(NodeSDK).mock.calls[0]?.[0] ?? {};
const OTLP = "http://localhost:14318";

afterEach(() => {
  vi.clearAllMocks();
});

describe("startTelemetry", () => {
  it("should do nothing when no exporter is configured", async () => {
    const telemetry = startTelemetry({ service: "api", env: {} });
    expect(telemetry.exporters).toEqual([]);
    expect(NodeSDK).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
    await expect(telemetry.shutdown()).resolves.toBeUndefined();
  });

  it("should export traces, metrics and logs when an OTLP endpoint is set", () => {
    const telemetry = startTelemetry({
      service: "api",
      env: { OTEL_EXPORTER_OTLP_ENDPOINT: OTLP },
      instrumentations: [],
    });
    expect(telemetry.exporters).toEqual(["otlp"]);
    expect(register).toHaveBeenCalledWith({ include: HOOKED_MODULES });
    expect(config()).toMatchObject({ serviceName: "api" });
    expect(config().spanProcessors).toHaveLength(1);
    expect(config().metricReaders).toHaveLength(1);
    expect(config().logRecordProcessors).toHaveLength(1);
    expect(getTelemetry()).toBe(telemetry);
  });

  it("should send only spans to Langfuse when just the Langfuse keys are set", () => {
    const telemetry = startTelemetry({
      service: "api",
      env: { LANGFUSE_PUBLIC_KEY: "pk", LANGFUSE_SECRET_KEY: "sk" },
      instrumentations: [],
    });
    expect(telemetry.exporters).toEqual(["langfuse"]);
    expect(config().spanProcessors).toHaveLength(1);
    expect(config().metricReaders).toBeUndefined();
  });

  it("should use both destinations when both are configured", () => {
    const telemetry = startTelemetry({
      service: "worker",
      env: {
        OTEL_EXPORTER_OTLP_ENDPOINT: OTLP,
        LANGFUSE_PUBLIC_KEY: "pk",
        LANGFUSE_SECRET_KEY: "sk",
      },
      instrumentations: [],
    });
    expect(telemetry.exporters).toEqual(["otlp", "langfuse"]);
    expect(config().spanProcessors).toHaveLength(2);
  });
});
