import { createHash } from "node:crypto";
import type { Redis } from "ioredis";

/**
 * Keys live for a day: long enough for client retries, short enough to bound memory.
 *
 * 幂等键保留一天：足够覆盖客户端重试，又能限制内存占用。
 */
export const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

/**
 * Outcome of claiming a key: `new` (proceed), `in-progress`, `replay` (return `value`),
 * or `mismatch` (same key, different body).
 *
 * 申领幂等键的结果：`new` 继续处理；`in-progress` 正在处理；`replay` 直接返回已有结果；
 * `mismatch` 同一个键配了不同的请求体。
 */
export type IdempotencyBegin<T> =
  | { status: "new" }
  | { status: "in-progress" }
  | { status: "replay"; value: T }
  | { status: "mismatch" };

/**
 * Storage behind `Idempotency-Key` handling.
 *
 * `Idempotency-Key` 处理所用的存储接口。
 */
export interface IdempotencyStore {
  /**
   * Claims `key` for this request. `fingerprint` identifies the request body so a key
   * reused with a different body is rejected instead of returning the wrong result.
   *
   * 为本次请求申领 `key`。`fingerprint` 标识请求体，同一个键配不同请求体时拒绝，而不是返回错误的结果。
   */
  begin: <T>(key: string, fingerprint: string) => Promise<IdempotencyBegin<T>>;
  /** Stores the result so retries replay it. 保存结果，供重试时重放。 */
  complete: (key: string, fingerprint: string, value: unknown) => Promise<void>;
  /** Releases a claim after a failure so the client can retry with the same key. 失败后释放，客户端可用同一个键重试。 */
  release: (key: string) => Promise<void>;
}

type Entry =
  | { state: "pending"; fingerprint: string }
  | { state: "done"; fingerprint: string; value: unknown };

/**
 * SHA-256 of the JSON body, used to detect a key reused with a different body.
 *
 * 请求体 JSON 的 SHA-256，用于识别同一幂等键配了不同请求体。
 */
export const fingerprintOf = (body: unknown) =>
  createHash("sha256").update(JSON.stringify(body)).digest("hex");

const interpret = <T>(entry: Entry, fingerprint: string): IdempotencyBegin<T> => {
  if (entry.fingerprint !== fingerprint) return { status: "mismatch" };
  return entry.state === "pending"
    ? { status: "in-progress" }
    : { status: "replay", value: entry.value as T };
};

/**
 * Redis-backed store; `SET NX` makes the claim atomic across instances.
 *
 * 基于 Redis 的实现；用 `SET NX` 保证多实例并发时申领是原子的。
 *
 * @param redis - Shared connection. 共享连接。
 * @param prefix - Key namespace. 键前缀。
 */
export const createRedisIdempotencyStore = (redis: Redis, prefix = "idem:"): IdempotencyStore => ({
  begin: async <T>(key: string, fingerprint: string) => {
    const redisKey = prefix + key;
    const pending: Entry = { state: "pending", fingerprint };
    // SET NX makes the claim atomic across concurrent requests and api instances.
    const claimed = await redis.set(
      redisKey,
      JSON.stringify(pending),
      "EX",
      IDEMPOTENCY_TTL_SECONDS,
      "NX",
    );
    if (claimed === "OK") return { status: "new" };
    const raw = await redis.get(redisKey);
    // Expired between SET and GET: treat as a fresh claim on the next attempt.
    if (raw === null) return { status: "in-progress" };
    return interpret<T>(JSON.parse(raw) as Entry, fingerprint);
  },
  complete: async (key, fingerprint, value) => {
    const done: Entry = { state: "done", fingerprint, value };
    await redis.set(prefix + key, JSON.stringify(done), "EX", IDEMPOTENCY_TTL_SECONDS);
  },
  release: async (key) => {
    await redis.del(prefix + key);
  },
});

/**
 * In-process store with the same semantics, for unit tests.
 *
 * 语义相同的进程内实现，用于单元测试。
 */
export const createMemoryIdempotencyStore = (): IdempotencyStore => {
  const entries = new Map<string, Entry>();
  return {
    begin: async <T>(key: string, fingerprint: string) => {
      const entry = entries.get(key);
      if (!entry) {
        entries.set(key, { state: "pending", fingerprint });
        return { status: "new" };
      }
      return interpret<T>(entry, fingerprint);
    },
    complete: async (key, fingerprint, value) => {
      entries.set(key, { state: "done", fingerprint, value });
    },
    release: async (key) => {
      entries.delete(key);
    },
  };
};
