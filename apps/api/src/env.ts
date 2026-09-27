import { resolveDatabaseUrl } from "@qic/db";
import { z } from "zod";

const isProduction = process.env.NODE_ENV === "production";

// Local docker-compose default outside production; required in production.
const withDevDefault = (schema: z.ZodType<string, string>, devValue: string) =>
  isProduction ? schema : z.string().default(devValue).pipe(schema);

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(14000),
  REDIS_URL: withDevDefault(z.url({ protocol: /^rediss?$/ }), "redis://localhost:16379"),
  /** Public origin users see (the web app). Auth links and cookies are issued for it. 用户访问的公开地址；鉴权链接和 Cookie 都针对它签发。 */
  PUBLIC_WEB_URL: withDevDefault(z.url({ protocol: /^https?$/ }), "http://localhost:13000"),
  /** Build identifier reported by /healthz; set by the image build. 构建标识，由镜像构建时写入。 */
  GIT_SHA: z.string().min(1).default("dev"),
  /** Optional: AI features are disabled when unset. 可选；未设置时关闭 AI 功能。 */
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  /** Optional model override; see @qic/ai DEFAULT_MODEL_ID. 可选的模型覆盖。 */
  AI_MODEL: z.string().min(1).optional(),
  /**
   * Model price in USD per million input/output tokens; enables the LLM cost metric when both are set.
   * 模型每百万输入/输出 token 的美元价格；两者都设置时记录 LLM 成本指标。
   */
  AI_PRICE_INPUT_USD_PER_MTOK: z.coerce.number().nonnegative().optional(),
  AI_PRICE_OUTPUT_USD_PER_MTOK: z.coerce.number().nonnegative().optional(),
  /**
   * Put prompts and model outputs on GenAI spans (and Langfuse). Off by default: they may contain user data.
   * 在 GenAI span（及 Langfuse）中记录提示词和模型输出。默认关闭，因为可能含用户数据。
   */
  AI_TRACE_CONTENT: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  /** Optional: error reporting is disabled when unset. 可选；未设置时不上报错误。 */
  SENTRY_DSN: z.url().optional(),
  /** Signs sessions and tokens. Generate with `openssl rand -base64 32`. 会话与令牌签名密钥。 */
  BETTER_AUTH_SECRET: withDevDefault(
    z.string().min(32),
    "dev-only-insecure-secret-change-me-0123456789",
  ),
  /**
   * Rate limiting for auth and `@RateLimit` routes. Defaults to on in production and off
   * elsewhere (parallel tests sign up many users from one IP).
   * 鉴权与 `@RateLimit` 路由的限流开关：生产环境默认开启，其他环境默认关闭（并行测试会从同一 IP 注册多个用户）。
   */
  RATE_LIMIT_ENABLED: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? isProduction : value === "true")),
});

/** Validated api environment. 校验后的 api 环境变量。 */
export type Env = z.infer<typeof EnvSchema> & { DATABASE_URL: string };

/**
 * Parses and validates process.env once at startup; throws with every problem listed.
 *
 * 启动时一次性解析并校验环境变量；有问题时抛出，并列出全部错误。
 * 非生产环境缺省值指向本地 docker-compose 服务。
 *
 * @param source - Variables to read. 读取的环境变量。
 */
export const loadEnv = (source: NodeJS.ProcessEnv = process.env): Env => ({
  ...EnvSchema.parse(source),
  DATABASE_URL: resolveDatabaseUrl(source),
});
