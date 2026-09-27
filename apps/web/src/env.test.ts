/*
 * Server-only environment of the web app: local default and production requirement.
 *
 * web 仅服务端环境变量：本地默认值与生产必填。
 */
import { afterEach, describe, expect, it, vi } from "vitest";

// getServerEnv caches its result, so each test loads a fresh module.
const loadGetServerEnv = async () => {
  vi.resetModules();
  return (await import("./env")).getServerEnv;
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getServerEnv", () => {
  it("should default to the local api when API_ORIGIN is unset outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("API_ORIGIN", undefined);
    expect((await loadGetServerEnv())().API_ORIGIN).toBe("http://localhost:14000");
  });

  it("should require API_ORIGIN when NODE_ENV is production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("API_ORIGIN", undefined);
    expect(await loadGetServerEnv()).toThrow("API_ORIGIN is required");
  });

  it("should reject an API_ORIGIN that is not an http(s) URL", async () => {
    vi.stubEnv("API_ORIGIN", "ftp://api");
    expect(await loadGetServerEnv()).toThrow();
  });

  it("should use API_ORIGIN when it is set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("API_ORIGIN", "http://api:4000");
    expect((await loadGetServerEnv())().API_ORIGIN).toBe("http://api:4000");
  });
});
