/*
 * Worker environment parsing: local defaults and production requirements.
 *
 * worker 环境变量解析：本地默认值与生产必填项。
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
  REDIS_URL: "redis://redis:6379",
  SMTP_URL: "smtps://user:pass@smtp.example.com:465",
  MAIL_FROM: "QiC <no-reply@example.com>",
};

describe("worker loadEnv", () => {
  it("should use the local Redis and Mailpit (by IP) in development", async () => {
    expect((await loadEnvFor({}))()).toMatchObject({
      REDIS_URL: "redis://localhost:16379",
      SMTP_URL: "smtp://127.0.0.1:11025",
      WORKER_HEALTH_PORT: 14100,
      WORKER_CONCURRENCY: 5,
    });
  });

  it.each(["REDIS_URL", "SMTP_URL", "MAIL_FROM"])(
    "should refuse to start in production without %s",
    async (name) => {
      const source: NodeJS.ProcessEnv = { ...production };
      delete source[name];
      expect(await loadEnvFor(source)).toThrow();
    },
  );

  it("should reject a concurrency outside 1..100", async () => {
    expect(await loadEnvFor({ ...production, WORKER_CONCURRENCY: "0" })).toThrow();
    expect(await loadEnvFor({ ...production, WORKER_CONCURRENCY: "500" })).toThrow();
  });
});
