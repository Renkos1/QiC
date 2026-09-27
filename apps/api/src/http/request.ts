import type { IncomingMessage } from "node:http";
import type { Logger } from "@qic/logger";
import type { AuthSession } from "../auth/auth.js";

/**
 * The Node request as seen by guards, filters and middleware. Only the fields this app
 * sets or reads are declared, so nothing depends on Express's own request type.
 *
 * 守卫、过滤器和中间件看到的 Node 请求对象。只声明本应用读写的字段，
 * 因此代码不依赖 Express 自身的请求类型。
 */
export type HttpRequest = IncomingMessage & {
  /** Set by Express: the URL before any routing rewrites. 路由改写前的原始 URL。 */
  originalUrl?: string;
  /** Set by requestContext for every request. 请求 id，由 requestContext 设置。 */
  requestId?: string;
  /** Child logger bound to the request id; set by requestContext. 绑定请求 id 的子日志器。 */
  logger?: Logger;
  /** Set by SessionGuard on protected routes. 受保护路由上由 SessionGuard 设置。 */
  user?: AuthSession["user"];
  session?: AuthSession["session"];
};

/**
 * Path without the query string, for logs and problem `instance`.
 *
 * 去掉查询串的路径，用于日志和错误响应的 `instance` 字段（避免把查询参数写进日志）。
 */
export const pathOf = (request: HttpRequest) =>
  (request.originalUrl ?? request.url ?? "/").split("?")[0] ?? "/";

/**
 * Client IP: the single-value `X-Forwarded-For` written by Caddy (which replaces any
 * value the client sent), else the socket peer. A multi-hop header is not trusted,
 * matching Better Auth's rule, so a client cannot choose its own rate-limit bucket.
 *
 * 客户端 IP：优先取 Caddy 写入的单值 `X-Forwarded-For`（Caddy 会覆盖客户端自带的值），否则取 socket 对端地址。
 * 多跳的头不被信任（与 Better Auth 的规则一致），客户端无法自选限流计数桶。
 */
export const clientIp = (request: HttpRequest): string | undefined => {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && !forwarded.includes(",")) return forwarded.trim();
  return request.socket.remoteAddress;
};
