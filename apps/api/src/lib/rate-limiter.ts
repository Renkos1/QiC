import type { Redis } from "ioredis";

/**
 * A limit: at most `max` requests per `window` seconds.
 *
 * 限流规则：每 `window` 秒最多 `max` 次请求。
 */
export interface RateLimitRule {
  window: number;
  max: number;
}

/**
 * Outcome of one request against a rule; `retryAfter` (seconds) is set when blocked.
 *
 * 一次请求的计数结果；被拒绝时 `retryAfter` 为需要等待的秒数。
 */
export interface RateLimitResult {
  allowed: boolean;
  retryAfter: number | null;
}

/**
 * Counts requests per key. The shape matches Better Auth's `rateLimit.customStorage`,
 * so auth routes and application routes share one limiter.
 *
 * 按键计数的限流器。接口与 Better Auth 的 `rateLimit.customStorage` 一致，
 * 因此鉴权路由与业务路由共用同一个限流器。
 */
export interface RateLimiter {
  /**
   * Records one request against `key` and reports whether it is within the rule.
   *
   * 为 `key` 记一次请求，并返回是否仍在限额内。
   */
  consume: (key: string, rule: RateLimitRule) => Promise<RateLimitResult>;
}

// INCR and EXPIRE in one step, so concurrent requests on several api instances can
// never all pass before the counter moves, and a key can never be left without a TTL.
const FIXED_WINDOW_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then redis.call("EXPIRE", KEYS[1], ARGV[1]) end
return { count, redis.call("TTL", KEYS[1]) }
`;

/**
 * Redis fixed-window limiter, shared by every api instance and surviving restarts.
 *
 * 基于 Redis 的固定窗口限流器：多个 api 实例共享计数，重启后不丢失。
 *
 * @param redis - Shared connection. 共享连接。
 * @param prefix - Key namespace. 键前缀。
 */
export const createRedisRateLimiter = (redis: Redis, prefix = "rl:"): RateLimiter => ({
  consume: async (key, { window, max }) => {
    const [count, ttl] = (await redis.eval(FIXED_WINDOW_SCRIPT, 1, prefix + key, window)) as [
      number,
      number,
    ];
    return count <= max ? { allowed: true, retryAfter: null } : { allowed: false, retryAfter: ttl };
  },
});

/**
 * In-process limiter with the same semantics, for unit tests.
 *
 * 语义相同的进程内限流器，用于单元测试。
 *
 * @param now - Clock in milliseconds (injectable for tests). 毫秒时钟，便于测试注入。
 */
export const createMemoryRateLimiter = (now: () => number = Date.now): RateLimiter => {
  const windows = new Map<string, { count: number; resetAt: number }>();
  return {
    consume: async (key, { window, max }) => {
      const current = windows.get(key);
      const entry =
        current && current.resetAt > now() ? current : { count: 0, resetAt: now() + window * 1000 };
      entry.count += 1;
      windows.set(key, entry);
      if (entry.count <= max) return { allowed: true, retryAfter: null };
      return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now()) / 1000) };
    },
  };
};
