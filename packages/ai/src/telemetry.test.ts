/*
 * Token and cost metrics recorded by the AI SDK telemetry integration. Runs a real
 * generateText call against a mock model with an in-memory OTel meter; no network, no SDK.
 *
 * AI SDK 遥测集成记录的 token 与成本指标。使用模拟模型真实调用 generateText，
 * 指标写入内存中的 OTel meter；不访问网络，不启动 OTel SDK。
 */
import { MeterProvider, MetricReader } from "@opentelemetry/sdk-metrics";
import { generateText } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import {
  COST_METRIC,
  createUsageMetrics,
  type ModelPricing,
  TOKEN_USAGE_METRIC,
  telemetryFor,
} from "./telemetry.js";

class TestReader extends MetricReader {
  protected async onForceFlush() {}
  protected async onShutdown() {}
}

const model = new MockLanguageModelV4({
  modelId: "mock-model",
  doGenerate: async () => ({
    content: [{ type: "text", text: "ok" }],
    finishReason: { unified: "stop", raw: undefined },
    usage: {
      inputTokens: { total: 1_000, noCache: 1_000, cacheRead: undefined, cacheWrite: undefined },
      outputTokens: { total: 500, text: 500, reasoning: undefined },
    },
    warnings: [],
  }),
});

/** Runs one call through the integration and returns the collected metrics by name. */
const collectAfterCall = async (pricing?: ModelPricing) => {
  const reader = new TestReader();
  const meter = new MeterProvider({ readers: [reader] }).getMeter("test");
  await generateText({
    model,
    prompt: "hi",
    telemetry: { functionId: "demo-op", integrations: createUsageMetrics(pricing, meter) },
  });
  const { resourceMetrics } = await reader.collect();
  const all = resourceMetrics.scopeMetrics.flatMap((scope) => scope.metrics);
  return (name: string) => all.find((metric) => metric.descriptor.name === name);
};

describe("createUsageMetrics", () => {
  it("should record input and output tokens labelled by model and operation", async () => {
    const metric = await collectAfterCall();
    const points = metric(TOKEN_USAGE_METRIC)?.dataPoints ?? [];
    const byType = Object.fromEntries(
      points.map((point) => [point.attributes["gen_ai.token.type"], point]),
    );
    expect(byType.input?.value).toMatchObject({ sum: 1_000, count: 1 });
    expect(byType.output?.value).toMatchObject({ sum: 500, count: 1 });
    expect(byType.input?.attributes).toMatchObject({
      "gen_ai.request.model": "mock-model",
      "qic.ai.operation": "demo-op",
    });
  });

  it("should add the estimated cost when pricing is configured", async () => {
    const metric = await collectAfterCall({ inputUsdPerMTok: 5, outputUsdPerMTok: 25 });
    // 1000 * 5 / 1e6 + 500 * 25 / 1e6
    expect(metric(COST_METRIC)?.dataPoints[0]?.value).toBeCloseTo(0.0175);
  });

  it("should not record cost when pricing is not configured", async () => {
    const metric = await collectAfterCall();
    expect(metric(COST_METRIC)?.dataPoints ?? []).toEqual([]);
  });
});

describe("telemetryFor", () => {
  it("should name the operation and keep prompt content off spans by default", () => {
    expect(telemetryFor("split-todos")).toEqual({
      functionId: "split-todos",
      recordInputs: false,
      recordOutputs: false,
    });
  });
});
