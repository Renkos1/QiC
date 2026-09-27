/*
 * The in-process rate limiter (same semantics as the Redis one) with a fake clock.
 *
 * 进程内限流器（语义与 Redis 版一致），使用可控的假时钟。
 */
import { describe, expect, it } from "vitest";
import { createMemoryRateLimiter } from "./rate-limiter.js";

const rule = { max: 2, window: 10 };

describe("memory rate limiter", () => {
  it("should allow requests up to the limit and then block with a retry time", async () => {
    let now = 0;
    const limiter = createMemoryRateLimiter(() => now);
    expect(await limiter.consume("k", rule)).toEqual({ allowed: true, retryAfter: null });
    expect(await limiter.consume("k", rule)).toEqual({ allowed: true, retryAfter: null });
    now = 4_000;
    expect(await limiter.consume("k", rule)).toEqual({ allowed: false, retryAfter: 6 });
  });

  it("should start a new window once the previous one has passed", async () => {
    let now = 0;
    const limiter = createMemoryRateLimiter(() => now);
    await limiter.consume("k", rule);
    await limiter.consume("k", rule);
    now = 10_001;
    expect((await limiter.consume("k", rule)).allowed).toBe(true);
  });

  it("should count keys independently", async () => {
    const limiter = createMemoryRateLimiter(() => 0);
    await limiter.consume("a", rule);
    await limiter.consume("a", rule);
    expect((await limiter.consume("b", rule)).allowed).toBe(true);
  });
});
