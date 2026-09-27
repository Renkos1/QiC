/*
 * api environment parsing: local defaults in development, required variables in production.
 *
 * api 环境变量解析：开发环境的本地默认值，生产环境的必填项。
 */
import { afterEach, describe, expect, it, vi } from "vitest";

// env.ts decides dev defaults at import time from NODE_ENV, so each test loads it fresh.
const loadEnvFor = async (source: NodeJS.ProcessEnv) => {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", source.NODE_ENV ?? "development");
  const { loadEnv } = await import("./env.js");
  return () => loadEnv(source);
};

afterEach(() => {
  vi.unstubAllEnvs();
});

const production = {
  NODE_ENV: "production",
  DATABASE_URL: "postgres://u:p@db:5432/app",
  REDIS_URL: "redis://redis:6379",
  PUBLIC_WEB_URL: "https://qic.example.com",
  BETTER_AUTH_SECRET: "s".repeat(32),
};

describe("api loadEnv", () => {
  it("should fall back to the local docker-compose services in development", async () => {
    const env = (await loadEnvFor({}))();
    expect(env).toMatchObject({
      PORT: 14000,
      REDIS_URL: "redis://localhost:16379",
      PUBLIC_WEB_URL: "http://localhost:13000",
      DATABASE_URL: "postgres://qic:qic@localhost:15432/qic",
    });
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
  });

  it("should accept a complete production environment and coerce PORT", async () => {
    const env = (await loadEnvFor({ ...production, PORT: "4000" }))();
    expect(env.PORT).toBe(4000);
    expect(env.PUBLIC_WEB_URL).toBe("https://qic.example.com");
  });

  it.each(["REDIS_URL", "PUBLIC_WEB_URL", "BETTER_AUTH_SECRET", "DATABASE_URL"])(
    "should refuse to start in production without %s",
    async (name) => {
      const source: NodeJS.ProcessEnv = { ...production };
      delete source[name];
      expect(await loadEnvFor(source)).toThrow();
    },
  );

  it("should reject a secret shorter than 32 characters", async () => {
    expect(await loadEnvFor({ ...production, BETTER_AUTH_SECRET: "short" })).toThrow();
  });
});
