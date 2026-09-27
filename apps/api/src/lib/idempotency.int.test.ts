/*
 * The Redis idempotency store against a real Redis container: atomic claims under
 * concurrency, replay, mismatch, release and TTL. Requires Docker.
 *
 * Redis 幂等存储对接真实 Redis 容器：并发下的原子申领、重放、请求体不一致、释放与过期时间。需要 Docker。
 */
import { RedisContainer, type StartedRedisContainer } from "@testcontainers/redis";
import { Redis } from "ioredis";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createRedisIdempotencyStore, IDEMPOTENCY_TTL_SECONDS } from "./idempotency.js";

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

describe("redis idempotency store", () => {
  it("should report in-progress while the first request holds the key", async () => {
    const store = createRedisIdempotencyStore(redis);
    expect(await store.begin("k", "body-a")).toEqual({ status: "new" });
    expect(await store.begin("k", "body-a")).toEqual({ status: "in-progress" });
  });

  it("should let exactly one of many concurrent requests claim the key", async () => {
    const store = createRedisIdempotencyStore(redis);
    const results = await Promise.all(Array.from({ length: 10 }, () => store.begin("k", "body-a")));
    expect(results.filter((r) => r.status === "new")).toHaveLength(1);
  });

  it("should replay the stored result once the request completed", async () => {
    const store = createRedisIdempotencyStore(redis);
    await store.begin("k", "body-a");
    await store.complete("k", "body-a", { id: "t1" });
    expect(await store.begin("k", "body-a")).toEqual({ status: "replay", value: { id: "t1" } });
  });

  it("should report a mismatch when the key is reused with a different body", async () => {
    const store = createRedisIdempotencyStore(redis);
    await store.begin("k", "body-a");
    await store.complete("k", "body-a", { id: "t1" });
    expect(await store.begin("k", "body-b")).toEqual({ status: "mismatch" });
  });

  it("should allow a retry after the claim is released", async () => {
    const store = createRedisIdempotencyStore(redis);
    await store.begin("k", "body-a");
    await store.release("k");
    expect(await store.begin("k", "body-a")).toEqual({ status: "new" });
  });

  it("should expire keys after the TTL so memory stays bounded", async () => {
    const store = createRedisIdempotencyStore(redis, "idem:");
    await store.begin("k", "body-a");
    const ttl = await redis.ttl("idem:k");
    expect(ttl).toBeGreaterThan(IDEMPOTENCY_TTL_SECONDS - 5);
    expect(ttl).toBeLessThanOrEqual(IDEMPOTENCY_TTL_SECONDS);
  });
});
