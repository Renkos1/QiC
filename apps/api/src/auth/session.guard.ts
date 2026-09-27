import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Inject,
  Injectable,
} from "@nestjs/common";
import { fromNodeHeaders } from "better-auth/node";
import { ProblemError } from "../http/problem.js";
import type { HttpRequest } from "../http/request.js";
import { AUTH } from "../tokens.js";
import type { Actor } from "./actor.js";
import type { AuthSession } from "./auth.js";

/**
 * The parts of Better Auth the HTTP layer uses; tests provide fakes with this shape.
 *
 * HTTP 层用到的 Better Auth 能力子集；测试按这个结构提供假实现。
 */
export interface AuthRuntime {
  /** Fetch-style handler for /api/auth/*. 处理 `/api/auth/*` 的 fetch 风格处理器。 */
  handler: (request: Request) => Promise<Response>;
  /** Session lookup from request headers. 根据请求头查询会话。 */
  api: {
    getSession: (input: { headers: Headers }) => Promise<AuthSession | null>;
  };
}

/**
 * Rejects the request with 401 problem+json unless it carries a valid session.
 *
 * 守卫：请求没有有效会话时返回 401 problem+json；通过后把用户和会话挂到请求上。
 *
 * @example \@UseGuards(SessionGuard)
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(AUTH) private readonly auth: AuthRuntime) {}

  /**
   * Resolves the session and attaches it to the request.
   *
   * 解析会话并挂到请求对象上。
   *
   * @throws {ProblemError} 401 without a valid session. 无有效会话时抛 401。
   */
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<HttpRequest>();
    const result = await this.auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    if (!result) throw new ProblemError(401, { detail: "Sign in required" });
    request.user = result.user;
    request.session = result.session;
    return true;
  }
}

/**
 * Injects the {@link Actor}; only valid on handlers guarded by {@link SessionGuard}.
 *
 * 参数装饰器：注入当前 {@link Actor}；只能用在受 {@link SessionGuard} 保护的处理函数上。
 */
export const CurrentActor = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const user = context.switchToHttp().getRequest<HttpRequest>().user;
  if (!user) throw new Error("CurrentActor used without SessionGuard");
  return { id: user.id, name: user.name, email: user.email } satisfies Actor;
});
