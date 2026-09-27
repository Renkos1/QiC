import { OpenTelemetry } from "@ai-sdk/otel";
import { type Meter, metrics } from "@opentelemetry/api";
import { registerTelemetry, type Telemetry } from "ai";

/**
 * Price of a model in US dollars per million tokens, from the provider's price list.
 *
 * 模型价格：每百万 token 的美元价格，取自服务商价目表。
 */
export interface ModelPricing {
  inputUsdPerMTok: number;
  outputUsdPerMTok: number;
}

/**
 * Options of {@link enableAiTelemetry}.
 *
 * {@link enableAiTelemetry} 的选项。
 */
export interface AiTelemetryOptions {
  /** Enables the cost counter; tokens are counted either way. 设置后记录成本；token 数总是记录。 */
  pricing?: ModelPricing | undefined;
  /** Put prompts and outputs on spans (they may contain user data). 在 span 上记录提示词和输出（可能含用户数据）。 */
  recordContent?: boolean;
}

/** Histogram of tokens per model call (OTel GenAI semantic conventions). 每次模型调用的 token 数直方图（OTel GenAI 语义约定）。 */
export const TOKEN_USAGE_METRIC = "gen_ai.client.token.usage";
/** Counter of failed AI operations by operation and error type (Prometheus: `qic_gen_ai_failures_total`). 按操作和错误类型统计的 AI 调用失败次数。 */
export const FAILURE_METRIC = "qic.gen_ai.failures";
/** Counter of estimated spend in USD (Prometheus: `qic_gen_ai_cost_USD_total`). 预估花费计数器（美元）。 */
export const COST_METRIC = "qic.gen_ai.cost";

/**
 * AI SDK telemetry integration that records token usage and, with pricing, estimated cost
 * for every language model call, labelled by provider, model and operation (`functionId`).
 *
 * AI SDK 遥测集成：为每次模型调用记录 token 用量；提供价格时还记录预估成本。
 * 指标按服务商、模型和操作名（`functionId`）区分。
 *
 * @param pricing - Enables the cost counter. 设置后记录成本。
 * @param meter - Defaults to the global meter (a no-op when telemetry is off). 默认用全局 meter。
 */
export const createUsageMetrics = (
  pricing?: ModelPricing,
  meter: Meter = metrics.getMeter("@qic/ai"),
): Telemetry => {
  const tokens = meter.createHistogram(TOKEN_USAGE_METRIC, {
    description: "Tokens used per model call",
    unit: "{token}",
  });
  const cost = meter.createCounter(COST_METRIC, {
    description: "Estimated model spend",
    unit: "USD",
  });
  return {
    onLanguageModelCallEnd: (event) => {
      const attributes = {
        "gen_ai.provider.name": event.provider,
        "gen_ai.request.model": event.modelId,
        "qic.ai.operation": event.functionId ?? "unknown",
      };
      const input = event.usage.inputTokens ?? 0;
      const output = event.usage.outputTokens ?? 0;
      tokens.record(input, { ...attributes, "gen_ai.token.type": "input" });
      tokens.record(output, { ...attributes, "gen_ai.token.type": "output" });
      if (pricing) {
        cost.add(
          (input * pricing.inputUsdPerMTok + output * pricing.outputUsdPerMTok) / 1_000_000,
          attributes,
        );
      }
    },
  };
};

let recordContent = false;
let registered = false;

/**
 * Turns on AI telemetry for the process: GenAI spans through OpenTelemetry (exported by
 * whatever `@qic/telemetry` configured, including Langfuse) and token/cost metrics.
 * Call once at startup; later calls are ignored.
 *
 * 为整个进程开启 AI 遥测：通过 OpenTelemetry 产生 GenAI span（由 `@qic/telemetry`
 * 配置的目标导出，包括 Langfuse），并记录 token 与成本指标。启动时调用一次，重复调用会被忽略。
 *
 * @param options - Pricing and whether to record prompt content. 价格以及是否记录提示词内容。
 */
export const enableAiTelemetry = ({
  pricing,
  recordContent: content = false,
}: AiTelemetryOptions = {}) => {
  if (registered) return;
  registered = true;
  recordContent = content;
  registerTelemetry(new OpenTelemetry(), createUsageMetrics(pricing));
};

/**
 * Per-call telemetry settings: names the operation and applies the content policy.
 *
 * 单次调用的遥测设置：标注操作名，并应用是否记录内容的策略。
 *
 * @param functionId - Operation name, e.g. "split-todos". 操作名。
 */
export const telemetryFor = (functionId: string) => ({
  functionId,
  recordInputs: recordContent,
  recordOutputs: recordContent,
});
