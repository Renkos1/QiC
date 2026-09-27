import { systemRoutes } from "./system/routes.js";
import { todoRoutes } from "./todos/routes.js";

/**
 * Every route that belongs in the public API document, in document order.
 *
 * 公开 API 文档中的全部路由，顺序即文档中的顺序。新增路由后要加到这里并运行 `pnpm gen`。
 */
export const apiRoutes = [...systemRoutes, ...todoRoutes] as const;

/**
 * Session cookie issued by Better Auth; all non-auth endpoints require it.
 *
 * Better Auth 签发的会话 Cookie；除鉴权接口外的所有接口都需要它。
 */
export const securitySchemes = {
  cookieAuth: {
    type: "apiKey",
    in: "cookie",
    name: "better-auth.session_token",
  },
} as const;

/**
 * Top-level metadata of `openapi/openapi.json` (written by `pnpm gen`).
 *
 * `openapi/openapi.json` 的顶层元数据（由 `pnpm gen` 写出）。`servers` 为 `/api`，
 * 因为浏览器经 web（开发）或 Caddy（部署）以同源的 `/api` 访问接口。
 */
export const openApiDocumentConfig = {
  openapi: "3.0.3",
  info: {
    title: "QiC API",
    version: "0.1.0",
    description: "QiC HTTP API.",
  },
  servers: [{ url: "/api" }],
};
