import type { ServerResponse } from "node:http";
import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from "@nestjs/common";
import { PROBLEM_CONTENT_TYPE, type Problem } from "@qic/contracts";
import { type Logger, traceFields } from "@qic/logger";
import { type ErrorReporter, NOOP_ERROR_REPORTER } from "@qic/telemetry";
import { ProblemError, problemBody } from "./problem.js";
import { type HttpRequest, pathOf } from "./request.js";

/**
 * Writes an RFC 9457 body; shared with the plain Express handlers in http-app.ts.
 *
 * 写出 RFC 9457 错误响应；http-app.ts 中的 Express 错误处理也复用它。
 *
 * @param request - Supplies `instance`, and `traceId` when tracing is off. 提供 `instance`；未开启追踪时也提供 `traceId`。
 * @param response - Node response to write to. 要写入的 Node 响应。
 * @param status - HTTP status. HTTP 状态码。
 * @param extra - Detail and field errors. 详情和字段错误。
 */
export const sendProblem = (
  request: HttpRequest,
  response: ServerResponse,
  status: number,
  extra: Omit<Partial<Problem>, "status"> = {},
) => {
  // The OTel trace id finds the whole trace in Grafana; without tracing, the request id finds the logs.
  const body = problemBody(status, {
    instance: pathOf(request),
    traceId: traceFields().traceId ?? request.requestId,
    ...extra,
  });
  response.statusCode = status;
  response.setHeader("content-type", PROBLEM_CONTENT_TYPE);
  response.end(JSON.stringify(body));
};

/**
 * Last-resort handler for everything thrown in Nest's pipeline: ProblemError keeps its
 * status and detail; Nest's own HTTP exceptions (unknown route, bad method) keep only
 * their status; anything else is logged with full context, sent to the error reporter
 * and returned as a generic 500 so internals never leak.
 *
 * 全局异常过滤器，兜底处理 Nest 管道中抛出的一切：ProblemError 保留状态码和详情；
 * Nest 自带的 HTTP 异常（未知路由等）只保留状态码；其他错误带完整上下文记录日志、
 * 上报到错误上报器，并统一返回通用的 500，绝不泄露内部细节。
 */
@Catch()
export class ProblemFilter implements ExceptionFilter {
  constructor(
    private readonly logger: Logger,
    private readonly errors: ErrorReporter = NOOP_ERROR_REPORTER,
  ) {}

  /**
   * Converts `error` into a problem+json response.
   *
   * 把 `error` 转换为 problem+json 响应。
   */
  catch(error: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<HttpRequest>();
    const response = http.getResponse<ServerResponse>();

    if (error instanceof ProblemError) {
      sendProblem(request, response, error.status, { detail: error.detail, errors: error.errors });
      return;
    }
    if (error instanceof HttpException && error.getStatus() < 500) {
      sendProblem(request, response, error.getStatus());
      return;
    }
    (request.logger ?? this.logger).error(
      { err: error, method: request.method, path: pathOf(request) },
      "unhandled error",
    );
    this.errors.capture(error, { method: request.method, path: pathOf(request) });
    sendProblem(request, response, 500);
  }
}
