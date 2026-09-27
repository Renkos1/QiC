import type { ServerResponse } from "node:http";
import { StandardSchemaValidationPipe } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Logger } from "@qic/logger";
import { type ErrorReporter, NOOP_ERROR_REPORTER } from "@qic/telemetry";
import { toNodeHandler } from "better-auth/node";
import type { AuthRuntime } from "./auth/session.guard.js";
import { ProblemFilter, sendProblem } from "./http/problem.filter.js";
import { validationProblem } from "./http/problem.js";
import type { HttpRequest } from "./http/request.js";
import { requestContext } from "./http/request-context.js";
import { AUTH } from "./tokens.js";

/**
 * Nest application options every entrypoint (server, tests) must use with configureHttpApp.
 *
 * 所有入口（服务、测试）创建 Nest 应用时都必须使用的选项，需与 {@link configureHttpApp} 配合。
 */
export const HTTP_APP_OPTIONS = {
  // Better Auth reads the raw request stream, so JSON parsing is registered after it.
  bodyParser: false,
} as const;

/** body-parser errors carry the status they want (400 malformed JSON, 413 too large). */
const isClientError = (error: unknown): error is { status: number } =>
  typeof error === "object" &&
  error !== null &&
  "status" in error &&
  typeof error.status === "number" &&
  error.status >= 400 &&
  error.status < 500;

/**
 * Applies the HTTP pipeline shared by the server and the tests. Order matters: request
 * context first, then Better Auth on its raw stream, then JSON parsing for Nest's routes.
 * /healthz and /readyz sit at the root for orchestrators; everything else lives under
 * /api, which the web app (dev) or Caddy (deploys) routes here.
 *
 * 装配服务与测试共用的 HTTP 管道，顺序很重要：先请求上下文，再让 Better Auth 读取原始请求流，
 * 最后才解析 JSON 给 Nest 路由。/healthz 和 /readyz 在根路径供编排器使用，其余都在 `/api` 下。
 * 同时注册全局 schema 校验管道和 {@link ProblemFilter}。
 *
 * @param app - A Nest app created with {@link HTTP_APP_OPTIONS}. 用 {@link HTTP_APP_OPTIONS} 创建的 Nest 应用。
 * @param logger - Root logger. 根日志器。
 * @param errors - Receives unexpected 5xx errors. 接收意外的 5xx 错误。
 * @returns The same app, configured. 配置好的同一个应用。
 */
export const configureHttpApp = (
  app: NestExpressApplication,
  logger: Logger,
  errors: ErrorReporter = NOOP_ERROR_REPORTER,
) => {
  const auth = app.get<AuthRuntime>(AUTH);
  const express = app.getHttpAdapter().getInstance();
  const authHandler = toNodeHandler(auth.handler);

  app.disable("x-powered-by");
  app.use("/api", requestContext(logger));
  express.get("/api/auth/*splat", authHandler);
  express.post("/api/auth/*splat", authHandler);
  app.useBodyParser("json");
  app.use(
    (
      error: unknown,
      request: HttpRequest,
      response: ServerResponse,
      next: (e: unknown) => void,
    ) => {
      if (!isClientError(error)) {
        next(error);
        return;
      }
      sendProblem(request, response, error.status);
    },
  );

  app.setGlobalPrefix("api", { exclude: ["healthz", "readyz"] });
  app.useGlobalPipes(new StandardSchemaValidationPipe({ exceptionFactory: validationProblem }));
  app.useGlobalFilters(new ProblemFilter(logger, errors));
  return app;
};
