# Runbook：LLM 输出异常

**告警**：`AI operations failing`（某个 AI 操作 15 分钟内超过 20% 的调用失败）。
用户反馈“AI 结果不对”时也按本手册排查。

所有模型调用都经过 `packages/ai` 的 `generateStructured`：输出必须通过 zod schema 校验，失败会抛出 `AiGenerationError`，调用方据此降级（界面提示功能暂不可用），不会把不合格的输出交给用户。

## 1. 看失败类型

```promql
# 按操作和错误类型统计的失败
sum by (qic_ai_operation, error_type) (increase(qic_gen_ai_failures_total[15m]))
# token 用量（突然变化往往意味着提示词或输入变了）
sum by (qic_ai_operation, gen_ai_token_type) (rate(gen_ai_client_token_usage_sum[15m]))
```

| `error_type` | 含义 | 处理 |
|---|---|---|
| `AI_NoObjectGeneratedError` | 模型输出不符合 schema（格式错误、条目超限等） | 看第 2 步，属于“输出质量”问题 |
| `AI_APICallError` / `AI_RetryError` | 服务商返回错误或重试耗尽（限流、过载、密钥失效） | 查看服务商状态页和账户配额；确认 `ANTHROPIC_API_KEY` 有效 |
| 超时类错误（如 `TimeoutError`、`AbortError`） | 超过 30 秒总超时 | 输入过长或服务商变慢；检查输入长度限制 |

## 2. 查看具体的输入和输出

- **Tempo**：`{ span.ai.telemetry.functionId = "<操作名>" && status = error }`，GenAI span 上有模型、token 数和耗时。
- **Langfuse**（已配置 `LANGFUSE_*` 时）：按操作名筛选，查看每次调用的完整过程。
- 默认**不记录**提示词和输出内容（可能含用户数据）。需要看内容时，只在本地或测试环境设置 `AI_TRACE_CONTENT=true` 复现，绝不在生产环境开启。

## 3. 常见原因

- **提示词或 schema 被改过**：`.describe()` 中的文字也会发送给模型。修改后必须运行 `pnpm eval` 与基线对比（AGENTS.md §13）。
- **模型版本变化**：`AI_MODEL` 或服务商侧的默认模型更新。用 `pnpm eval` 对比新旧模型。
- **输入超出预期**：超长文本、其他语言或提示词注入。检查输入长度限制，以及不可信文本是否已包在标签中作为数据。
- **成本异常**：`qic_gen_ai_cost_USD_total`（设置了 `AI_PRICE_*` 时）突增，通常是调用量或输出长度变化，检查 `maxOutputTokens` 与限流配置（AI 接口使用 `@RateLimit`）。

## 4. 修复后

把导致问题的输入（脱敏后）加入 `evals/` 的用例，防止回归。
