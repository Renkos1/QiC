/*
 * Database URL resolution: development fallback and production requirement.
 *
 * 数据库连接串解析：开发回退与生产必填。
 */
import { describe, expect, it } from "vitest";
import { DEV_DATABASE_URL, resolveDatabaseUrl } from "./env.js";

describe("resolveDatabaseUrl", () => {
  it("should return DATABASE_URL when it is set", () => {
    const url = "postgres://u:p@db:5432/app";
    expect(resolveDatabaseUrl({ DATABASE_URL: url })).toBe(url);
  });

  it("should fall back to the local database when DATABASE_URL is missing outside production", () => {
    expect(resolveDatabaseUrl({ NODE_ENV: "development" })).toBe(DEV_DATABASE_URL);
  });

  it("should throw when DATABASE_URL is missing in production", () => {
    expect(() => resolveDatabaseUrl({ NODE_ENV: "production" })).toThrow(/DATABASE_URL/);
  });

  it("should throw when DATABASE_URL is not a postgres URL", () => {
    expect(() => resolveDatabaseUrl({ DATABASE_URL: "mysql://u:p@db/app" })).toThrow();
  });
});
