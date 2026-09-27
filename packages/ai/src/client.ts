import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

/**
 * Default model; override with `AI_MODEL`. Model IDs are configuration, not code (AGENTS.md §13).
 *
 * 默认模型；可用环境变量 `AI_MODEL` 覆盖。模型 ID 属于配置而不是代码（AGENTS.md §13）。
 */
export const DEFAULT_MODEL_ID = "claude-opus-5";

/**
 * Inputs of {@link createLanguageModel}, usually straight from the environment.
 *
 * {@link createLanguageModel} 的输入，通常直接来自环境变量。
 */
export interface AiConfig {
  /** `ANTHROPIC_API_KEY`; AI is disabled when unset. 未设置时禁用 AI。 */
  apiKey: string | undefined;
  /** `AI_MODEL` override. 覆盖默认模型。 */
  modelId?: string | undefined;
}

/**
 * Returns the configured model, or null when no API key is set so callers can
 * disable AI features instead of failing at request time.
 *
 * 返回配置好的模型；没有 API 密钥时返回 null，调用方据此关闭 AI 功能，而不是在请求时才失败。
 *
 * @param config - API key and optional model override. API 密钥与可选的模型覆盖。
 */
export const createLanguageModel = ({ apiKey, modelId }: AiConfig): LanguageModel | null => {
  if (!apiKey) return null;
  return createAnthropic({ apiKey })(modelId ?? DEFAULT_MODEL_ID);
};
