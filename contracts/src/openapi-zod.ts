import { extendZodWithOpenApi, type RouteConfig } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

// Contract files import `z` from here so the extension is installed before any schema is built.
extendZodWithOpenApi(z);

/**
 * zod with `.openapi()` metadata support. Import `z` from this module in contract files.
 *
 * 扩展了 `.openapi()` 元数据的 zod。契约文件必须从本模块导入 `z`，否则 `.openapi()` 不可用。
 */
export { z };

/**
 * Declares an API operation. The literal type is kept so the api can derive handler
 * input and output types from the same object that generates the OpenAPI document.
 *
 * 声明一个 API 操作。保留字面量类型，使同一个对象既生成 OpenAPI 文档，
 * 又被 api 的 `@ContractRoute` 等装饰器用来注册路由和校验输入。
 *
 * @param route - Method, path, request schemas and responses. 方法、路径、请求 schema 和响应。
 * @returns The same object, typed. 原样返回，保留类型。
 */
export const defineRoute = <R extends RouteConfig>(route: R): R => route;

/** Shape accepted by {@link defineRoute}. {@link defineRoute} 接受的路由结构。 */
export type { RouteConfig };
