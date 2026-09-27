import createClient, { type ClientOptions } from "openapi-fetch";
import type { components, paths } from "./schema.gen.js";

/** Types generated from `openapi.json` by `pnpm gen`. 由 `pnpm gen` 从 `openapi.json` 生成的类型。 */
export type { components, operations, paths } from "./schema.gen.js";

/**
 * Response/request body types by component name, e.g. `Schemas["Todo"]`.
 *
 * 按组件名索引的请求/响应体类型，例如 `Schemas["Todo"]`。由 `pnpm gen` 从契约生成。
 */
export type Schemas = components["schemas"];

/** The typed client returned by {@link createApiClient}. 类型化的 API 客户端。 */
export type ApiClient = ReturnType<typeof createApiClient>;

/**
 * Creates a typed client for the QiC API. `fetch` is looked up on every call rather than
 * captured at creation, so instrumentation that wraps it later (browser tracing) applies.
 *
 * 创建类型化的 QiC API 客户端；路径、参数和响应类型都来自生成的 OpenAPI 类型。
 * 每次调用时才读取全局 `fetch`，而不是在创建时固定，这样之后才包装 fetch 的插桩（浏览器链路追踪）也能生效。
 *
 * @param options - openapi-fetch options; `baseUrl` defaults to "/api" (same-origin via the web proxy).
 *   openapi-fetch 选项；`baseUrl` 默认为 `/api`（经 web 代理同源访问），并携带 Cookie。
 */
export const createApiClient = (options: ClientOptions = {}) =>
  createClient<paths>({
    baseUrl: "/api",
    credentials: "include",
    fetch: (request) => globalThis.fetch(request),
    ...options,
  });
