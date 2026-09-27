import { z } from "zod";

/**
 * Matches the postgres service in docker-compose.yml; never used when NODE_ENV=production.
 *
 * 对应 docker-compose.yml 中的 postgres 服务（宿主机端口 15432）；生产环境绝不使用。
 */
export const DEV_DATABASE_URL = "postgres://qic:qic@localhost:15432/qic";

const DatabaseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }).optional(),
});

/**
 * Resolves the database URL from the environment. Outside production it falls back
 * to the local docker-compose database so a fresh clone works without a .env file.
 *
 * 从环境变量解析数据库连接串。非生产环境缺省时回退到本地 docker-compose 数据库，
 * 因此新克隆的仓库无需 `.env` 即可运行。
 *
 * @param env - Variables to read; defaults to `process.env`. 读取的环境变量，默认 `process.env`。
 * @returns The Postgres URL. Postgres 连接串。
 * @throws If the variables are invalid, or DATABASE_URL is missing in production.
 *   变量格式错误，或生产环境缺少 `DATABASE_URL` 时抛出。
 */
export const resolveDatabaseUrl = (env: NodeJS.ProcessEnv = process.env): string => {
  const parsed = DatabaseEnvSchema.parse(env);
  if (parsed.DATABASE_URL) return parsed.DATABASE_URL;
  if (parsed.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is required when NODE_ENV=production");
  }
  return DEV_DATABASE_URL;
};
