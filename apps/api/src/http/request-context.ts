import { randomUUID } from "node:crypto";
import type { ServerResponse } from "node:http";
import type { Logger } from "@qic/logger";
import { type HttpRequest, pathOf } from "./request.js";

/** Header carrying the request id in both directions. 请求与响应中携带请求 id 的头。 */
export const REQUEST_ID_HEADER = "x-request-id";

/** Accept a caller-supplied id only if it is short and printable, to keep logs safe. */
const SAFE_REQUEST_ID = /^[\w.:-]{1,128}$/;

/**
 * Express middleware, registered before Better Auth and Nest's routes so every /api
 * request gets it: assigns a request id (reusing a safe inbound one from the proxy),
 * binds a child logger to it, echoes it in the response and writes one access-log line.
 *
 * Express 中间件，注册在 Better Auth 和 Nest 路由之前，覆盖所有 `/api` 请求：
 * 分配请求 id（代理传入的 id 安全时沿用），绑定子日志器，在响应头回显，并在响应结束时写一行访问日志。
 * 503 记为 warn（主动降级），其他 5xx 记为 error。
 *
 * @param logger - Root logger. 根日志器。
 */
export const requestContext =
  (logger: Logger) => (request: HttpRequest, response: ServerResponse, next: () => void) => {
    const inbound = request.headers[REQUEST_ID_HEADER];
    const requestId =
      typeof inbound === "string" && SAFE_REQUEST_ID.test(inbound) ? inbound : randomUUID();
    const requestLogger = logger.child({ requestId });
    request.requestId = requestId;
    request.logger = requestLogger;
    response.setHeader(REQUEST_ID_HEADER, requestId);

    const startedAt = performance.now();
    response.once("finish", () => {
      const status = response.statusCode;
      const fields = {
        method: request.method,
        path: pathOf(request),
        status,
        durationMs: Math.round(performance.now() - startedAt),
        userId: request.user?.id,
      };
      // 503 is a deliberate "unavailable" answer (e.g. AI not configured), not a defect.
      if (status === 503) requestLogger.warn(fields, "request unavailable");
      else if (status >= 500) requestLogger.error(fields, "request failed");
      else requestLogger.info(fields, "request completed");
    });
    next();
  };
