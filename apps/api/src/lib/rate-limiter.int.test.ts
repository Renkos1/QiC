/*
 * The Redis rate limiter against a real Redis container: atomic counting under
 * concurrency, retry time and key expiry. Requires Docker.
 *
 * Redis 限流器对接真实 Redis 容器：并发下计数原子性、重试等待时间与键过期。需要 Docker。
 */
import { RedisContainer, type StartedRedisContainer } from "@testcontainers/redis";
import { Redis } from "ioredis";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createRedisRateLimiter } from "./rate-limiter.js";

let container: StartedRedisContainer;
let redis: Redis;

beforeAll(async () => {
  container = await new RedisContainer("redis:8.8.3-alpine").start();
  redis = new Redis(container.getConnectionUrl());
});

afterAll(async () => {
  redis?.disconnect();
  await container?.stop();
});

beforeEach(async () => {
  await redis.flushdb();
});

describe("redis rate limiter", () => {
  it("should allow exactly `max` of many concurrent requests", async () => {
    const limiter = createRedisRateLimiter(redis);
    const results = await Promise.all(
      Array.from({ length: 20 }, () => limiter.consume("k", { max: 5, window: 60 })),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
  });

  it("should report how long to wait once blocked", async () => {
    const limiter = createRedisRateLimiter(redis);
    await limiter.consume("k", { max: 1, window: 60 });
    const blocked = await limiter.consume("k", { max: 1, window: 60 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(55);
    expect(blocked.retryAfter).toBeLessThanOrEqual(60);
  });

  it("should always give the counter an expiry so keys cannot pile up", async () => {
    const limiter = createRedisRateLimiter(redis, "rl:");
    await limiter.consume("k", { max: 5, window: 30 });
    const ttl = await redis.ttl("rl:k");
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(30);
  });
});
