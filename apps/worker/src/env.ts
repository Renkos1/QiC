import { z } from "zod";

const isProduction = process.env.NODE_ENV === "production";

// Local docker-compose default outside production; required in production.
const withDevDefault = (schema: z.ZodType<string, string>, devValue: string) =>
  isProduction ? schema : z.string().default(devValue).pipe(schema);

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  REDIS_URL: withDevDefault(z.url({ protocol: /^rediss?$/ }), "redis://localhost:16379"),
  // An IP literal: nodemailer resolves hostnames via DNS queries rather than the hosts
  // file, so "localhost" hangs on machines whose resolver does not answer for it.
  SMTP_URL: withDevDefault(z.url({ protocol: /^smtps?$/ }), "smtp://127.0.0.1:11025"),
  MAIL_FROM: withDevDefault(z.string().min(3), "QiC <no-reply@qic.local>"),
  /** Port for the container health check endpoint (GET /healthz). 健康检查接口的端口。 */
  WORKER_HEALTH_PORT: z.coerce.number().int().min(1).max(65_535).default(14100),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(100).default(5),
  /** Build identifier used as the log and Sentry release; set by the image build. 构建标识，作为日志与 Sentry 的 release，由镜像构建写入。 */
  GIT_SHA: z.string().min(1).default("dev"),
  /** Optional: error reporting is disabled when unset. 可选；未设置时不上报错误。 */
  SENTRY_DSN: z.url().optional(),
});

/** Validated worker environment. 校验后的 worker 环境变量。 */
export type Env = z.infer<typeof EnvSchema>;

/**
 * Parses and validates process.env once at startup; throws with every problem listed.
 *
 * 启动时一次性解析并校验环境变量；有问题时抛出并列出全部错误。非生产环境有本地默认值。
 *
 * @param source - Variables to read. 读取的环境变量。
 */
export const loadEnv = (source: NodeJS.ProcessEnv = process.env): Env => EnvSchema.parse(source);
