import { metrics } from "@opentelemetry/api";
import type { Logger } from "@qic/logger";
import { generateText, type LanguageModel, Output } from "ai";
import type { z } from "zod";
import { FAILURE_METRIC, telemetryFor } from "./telemetry.js";

/**
 * Options of {@link generateStructured}.
 *
 * {@link generateStructured} 的选项。
 */
export interface GenerateStructuredOptions<T extends z.ZodType> {
  model: LanguageModel;
  /** Output schema; the result is validated against it before being returned. 输出 schema，返回前按它校验。 */
  schema: T;
  /** System prompt, reviewed as code. 系统提示词，按代码审查。 */
  system: string;
  /** User prompt; wrap untrusted text as data. 用户提示词；不可信文本要作为数据包裹。 */
  prompt: string;
  logger: Logger;
  /** Short operation name for logs, spans and metrics, e.g. "split-todos". 操作名，用于日志、span 和指标。 */
  operation: string;
  /** Wall-clock limit for the whole call including retries. 整个调用（含重试）的总超时。 */
  timeoutMs?: number;
  /** Provider-level retries for transient failures (429/5xx/network). 对临时故障的重试次数。 */
  maxRetries?: number;
  /** Output token budget. 输出 token 上限。 */
  maxOutputTokens?: number;
}

/**
 * A validated model output plus the metadata needed for cost and latency tracking.
 *
 * 通过校验的模型输出，以及用于成本和延迟统计的元数据。
 */
export interface StructuredResult<T> {
  output: T;
  usage: { inputTokens: number | undefined; outputTokens: number | undefined };
  modelId: string;
  latencyMs: number;
}

/**
 * Thrown when the model call fails, times out or returns output that fails the schema.
 *
 * 模型调用失败、超时或输出不符合 schema 时抛出；原始错误保存在 `cause` 中。
 */
export class AiGenerationError extends Error {
  constructor(
    readonly operation: string,
    options: { cause: unknown },
  ) {
    super(`AI operation "${operation}" failed`, options);
    this.name = "AiGenerationError";
  }
}

/** Error class name, e.g. "NoObjectGeneratedError" (schema mismatch) or "APICallError". 错误类名。 */
const errorType = (error: unknown) => (error instanceof Error ? error.name : "unknown");

/** Default wall-clock limit per call. 单次调用的默认总超时。 */
export const DEFAULT_TIMEOUT_MS = 30_000;
/** Default provider retries. 默认重试次数。 */
export const DEFAULT_MAX_RETRIES = 2;

/**
 * Generates an object that satisfies `schema`, with a timeout, bounded retries,
 * token/latency logging and a failure metric. Callers treat any failure as
 * "feature unavailable" and degrade.
 *
 * 生成符合 `schema` 的结构化对象，带超时、有限重试，并记录 token 用量和延迟；失败时计入
 * {@link FAILURE_METRIC} 指标。
 * 调用方应把任何失败视为“功能暂不可用”并降级处理。日志不记录提示词和输出内容（可能含用户数据）。
 *
 * @param options - Model, schema, prompts and limits. 模型、schema、提示词和各项限制。
 * @returns The validated output with usage metadata. 通过校验的输出及用量元数据。
 * @throws {AiGenerationError} On any failure, with the original error as `cause`. 任何失败都抛出，原始错误在 `cause`。
 */
export const generateStructured = async <T extends z.ZodType>({
  model,
  schema,
  system,
  prompt,
  logger,
  operation,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxRetries = DEFAULT_MAX_RETRIES,
  maxOutputTokens = 2_000,
}: GenerateStructuredOptions<T>): Promise<StructuredResult<z.infer<T>>> => {
  const startedAt = performance.now();
  try {
    const result = await generateText({
      model,
      system,
      prompt,
      output: Output.object({ schema }),
      maxRetries,
      maxOutputTokens,
      timeout: timeoutMs,
      telemetry: telemetryFor(operation),
    });
    const latencyMs = Math.round(performance.now() - startedAt);
    const usage = {
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
    };
    const modelId = result.response.modelId;
    logger.info({ operation, modelId, latencyMs, ...usage }, "ai generation succeeded");
    return { output: result.output as z.infer<T>, usage, modelId, latencyMs };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - startedAt);
    // Prompt and output may contain user data; log metadata and the error only.
    logger.warn({ operation, latencyMs, err: error }, "ai generation failed");
    metrics
      .getMeter("@qic/ai")
      .createCounter(FAILURE_METRIC, { description: "Failed AI operations" })
      .add(1, { "qic.ai.operation": operation, "error.type": errorType(error) });
    throw new AiGenerationError(operation, { cause: error });
  }
};
