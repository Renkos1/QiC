import { z } from "zod";

const ServerEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /** Internal origin of apps/api for server-side calls. Never exposed to the browser. api 的内部地址，仅服务端使用。 */
  API_ORIGIN: z.url({ protocol: /^https?$/ }).optional(),
});

/** Validated server-only environment. 校验后的仅服务端环境变量。 */
export type ServerEnv = { API_ORIGIN: string };

let cached: ServerEnv | undefined;

/**
 * Server-only environment, validated on first use at runtime (not at build time,
 * so one image can be promoted across environments). Required in production.
 *
 * 仅服务端使用的环境变量，在运行时首次使用时校验（而不是构建时），
 * 这样同一个镜像可以在不同环境间晋升。生产环境必须设置 `API_ORIGIN`。
 *
 * @throws If `API_ORIGIN` is invalid, or missing in production. 格式错误或生产环境缺失时抛出。
 */
export const getServerEnv = (): ServerEnv => {
  if (cached) return cached;
  const parsed = ServerEnvSchema.parse(process.env);
  if (!parsed.API_ORIGIN && parsed.NODE_ENV === "production") {
    throw new Error("API_ORIGIN is required when NODE_ENV=production");
  }
  cached = { API_ORIGIN: parsed.API_ORIGIN ?? "http://localhost:14000" };
  return cached;
};
