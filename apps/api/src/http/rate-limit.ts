import type { ServerResponse } from "node:http";
import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UseGuards,
} from "@nestjs/common";
import type { RateLimiter } from "../lib/rate-limiter.js";
import { RATE_LIMITER } from "../tokens.js";
import { ProblemError } from "./problem.js";
import { clientIp, type HttpRequest } from "./request.js";

/**
 * A named limit for one route or a group of routes.
 *
 * 一条具名的限流策略，可用于单个路由或一组路由。
 */
export interface RateLimitPolicy {
  /** Counter namespace; routes sharing a name share the budget. 计数命名空间；同名路由共享额度。 */
  name: string;
  /** Requests allowed per window. 每个窗口允许的请求数。 */
  max: number;
  /** Window length in seconds. 窗口长度（秒）。 */
  window: number;
  /**
   * Count per signed-in user (needs `SessionGuard` first) or per client IP.
   * 按已登录用户计数（需先经过 `SessionGuard`），或按客户端 IP 计数。
   */
  by: "user" | "ip";
}

/**
 * Method or controller decorator: rejects requests over the policy with 429 problem+json
 * and a `Retry-After` header. A no-op when rate limiting is disabled (`RATE_LIMIT_ENABLED`).
 *
 * 方法或控制器装饰器：超出策略的请求返回 429 problem+json 并带 `Retry-After` 头。
 * 限流关闭（`RATE_LIMIT_ENABLED`）时不做任何事。
 *
 * `by: "user"` needs the session first: put `SessionGuard` on the controller, or list
 * `@UseGuards(SessionGuard)` *below* `@RateLimit` on the method (decorators apply bottom-up).
 * `by: "user"` 需要先解析会话：把 `SessionGuard` 放在控制器上，或在同一方法上把
 * `@UseGuards(SessionGuard)` 写在 `@RateLimit` 的*下方*（装饰器自下而上生效）。
 *
 * @param policy - Name, budget and what to count by. 策略名、额度与计数维度。
 * @example \@RateLimit({ name: "ai", max: 10, window: 60, by: "user" })
 */
export const RateLimit = (policy: RateLimitPolicy) => {
  @Injectable()
  class RateLimitGuard implements CanActivate {
    constructor(@Inject(RATE_LIMITER) private readonly limiter: RateLimiter | null) {}

    async canActivate(context: ExecutionContext) {
      if (!this.limiter) return true;
      const http = context.switchToHttp();
      const request = http.getRequest<HttpRequest>();
      const subject = policy.by === "user" ? request.user?.id : clientIp(request);
      // Misconfiguration (user policy without SessionGuard), not a client error.
      if (!subject) throw new Error(`RateLimit "${policy.name}" could not identify the caller`);

      const { allowed, retryAfter } = await this.limiter.consume(
        `${policy.name}:${policy.by}:${subject}`,
        { max: policy.max, window: policy.window },
      );
      if (allowed) return true;
      http
        .getResponse<ServerResponse>()
        .setHeader("Retry-After", String(retryAfter ?? policy.window));
      throw new ProblemError(429, { detail: "Too many requests, try again later" });
    }
  }
  return UseGuards(RateLimitGuard);
};
