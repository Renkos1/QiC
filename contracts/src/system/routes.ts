import { problemResponse } from "../common/problem.js";
import { defineRoute, z } from "../openapi-zod.js";

/**
 * Optional features enabled on this deployment, so the UI can hide what is unavailable.
 *
 * 当前部署启用了哪些可选功能，供前端隐藏不可用的入口。
 */
export const CapabilitiesSchema = z
  .object({
    /** AI features are available (an API key is configured). 服务端已配置 AI 密钥。 */
    ai: z.boolean(),
  })
  .openapi("Capabilities");

/** Optional features of this deployment. 当前部署的可选功能。 */
export type Capabilities = z.infer<typeof CapabilitiesSchema>;

/**
 * `GET /capabilities`: feature flags for the signed-in user.
 *
 * `GET /capabilities`：返回已登录用户可用的功能开关。
 */
export const getCapabilitiesRoute = defineRoute({
  operationId: "getCapabilities",
  method: "get",
  path: "/capabilities",
  tags: ["system"],
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      description: "Optional features enabled on this deployment",
      content: { "application/json": { schema: CapabilitiesSchema } },
    },
    401: problemResponse("Not signed in"),
  },
});

/**
 * All system routes, in OpenAPI document order.
 *
 * 全部系统路由，顺序即 OpenAPI 文档中的顺序。
 */
export const systemRoutes = [getCapabilitiesRoute] as const;
