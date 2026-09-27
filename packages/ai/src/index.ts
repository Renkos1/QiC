/** AI SDK model handle, re-exported so apps need no direct `ai` dependency. AI SDK 的模型类型，应用无需直接依赖 `ai`。 */
export type { LanguageModel } from "ai";
export { type AiConfig, createLanguageModel, DEFAULT_MODEL_ID } from "./client.js";
export {
  buildSplitTodosPrompt,
  SPLIT_TODOS_MAX_INPUT,
  SPLIT_TODOS_MAX_ITEMS,
  type SplitTodos,
  SplitTodosSchema,
  splitIntoTodos,
} from "./prompts/split-todos.js";
export {
  AiGenerationError,
  DEFAULT_MAX_RETRIES,
  DEFAULT_TIMEOUT_MS,
  type GenerateStructuredOptions,
  generateStructured,
  type StructuredResult,
} from "./structured.js";
export {
  type AiTelemetryOptions,
  COST_METRIC,
  createUsageMetrics,
  enableAiTelemetry,
  FAILURE_METRIC,
  type ModelPricing,
  TOKEN_USAGE_METRIC,
  telemetryFor,
} from "./telemetry.js";
