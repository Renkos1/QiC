import {
  applyDecorators,
  Body,
  createParamDecorator,
  Delete,
  type ExecutionContext,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import type { RouteConfig } from "@qic/contracts";
import { z } from "zod";
import { validationProblem } from "./problem.js";
import type { HttpRequest } from "./request.js";

/*
 * Binds Nest handlers to the route objects in @qic/contracts, so method, path, success
 * status and input schemas come from the same definition that generates openapi.json.
 * Validation itself runs in Nest's StandardSchemaValidationPipe (see http-app.ts).
 *
 * 把 Nest 处理函数绑定到 @qic/contracts 中的路由对象，方法、路径、成功状态码和
 * 输入 schema 与 openapi.json 同源，不会漂移。校验本身由 Nest 的 StandardSchemaValidationPipe 执行。
 */

const METHODS = { get: Get, post: Post, put: Put, patch: Patch, delete: Delete };

const describe = (route: RouteConfig) => `${route.method.toUpperCase()} ${route.path}`;

/** OpenAPI templates (`/todos/{id}`) to Express paths (`todos/:id`). */
const toNestPath = (path: string) => path.replace(/\{(\w+)\}/g, ":$1").replace(/^\//, "");

const successStatus = (route: RouteConfig) => {
  const status = Object.keys(route.responses)
    .map(Number)
    .find((code) => code >= 200 && code < 300);
  if (status === undefined) throw new Error(`${describe(route)} declares no 2xx response`);
  return status;
};

const schemaOf = (route: RouteConfig, part: string, schema: unknown): z.ZodType => {
  if (schema instanceof z.ZodType) return schema;
  throw new Error(`${describe(route)} has no zod ${part} schema in its contract`);
};

/**
 * Method decorator: registers the handler at the contract's method, path and 2xx status.
 *
 * 方法装饰器：按契约中的方法、路径和 2xx 状态码注册处理函数。
 *
 * @param route - A route from `@qic/contracts`. 来自 `@qic/contracts` 的路由。
 * @throws At startup if the route has no 2xx response or an unsupported method. 路由缺少 2xx 响应或方法不受支持时在启动阶段抛出。
 * @example \@ContractRoute(getTodoRoute)
 */
export const ContractRoute = (route: RouteConfig) => {
  const method = METHODS[route.method as keyof typeof METHODS];
  if (!method) throw new Error(`${describe(route)}: unsupported method`);
  return applyDecorators(method(toNestPath(route.path)), HttpCode(successStatus(route)));
};

/**
 * Parameter decorator: the JSON body, validated against the contract.
 *
 * 参数装饰器：按契约校验后的 JSON 请求体。
 *
 * @param route - Route declaring `request.body`. 声明了 `request.body` 的路由。
 */
export const ContractBody = (route: RouteConfig) => {
  const media = route.request?.body?.content["application/json"];
  return Body({
    schema: schemaOf(route, "body", media && "schema" in media ? media.schema : null),
  });
};

/**
 * Parameter decorator: the query string, validated (and coerced) against the contract.
 *
 * 参数装饰器：按契约校验（并做类型转换）后的查询参数。
 *
 * @param route - Route declaring `request.query`. 声明了 `request.query` 的路由。
 */
export const ContractQuery = (route: RouteConfig) =>
  Query({ schema: schemaOf(route, "query", route.request?.query) });

/**
 * Parameter decorator: path parameters, validated against the contract.
 *
 * 参数装饰器：按契约校验后的路径参数。
 *
 * @param route - Route declaring `request.params`. 声明了 `request.params` 的路由。
 */
export const ContractParams = (route: RouteConfig) =>
  Param({ schema: schemaOf(route, "params", route.request?.params) });

/**
 * Parameter decorator: request headers, validated against the contract. Nest's `@Headers()`
 * takes no schema, so this validates itself and reports failures the same way as the pipe.
 *
 * 参数装饰器：按契约校验后的请求头。Nest 的 `@Headers()` 不接受 schema，
 * 所以这里自行校验，并以与管道相同的 400 格式报告错误。
 */
export const ContractHeaders = createParamDecorator(
  (route: RouteConfig, context: ExecutionContext) => {
    const schema = schemaOf(route, "headers", route.request?.headers);
    const result = schema.safeParse(context.switchToHttp().getRequest<HttpRequest>().headers);
    if (!result.success) throw validationProblem(result.error.issues);
    return result.data;
  },
);
