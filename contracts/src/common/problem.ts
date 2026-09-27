import { z } from "../openapi-zod.js";

/**
 * Media type for every error response (RFC 9457).
 *
 * 所有错误响应的媒体类型（RFC 9457）。
 */
export const PROBLEM_CONTENT_TYPE = "application/problem+json";

/**
 * A single field-level validation failure; `path` is dot-separated (`items.0.title`).
 *
 * 单个字段的校验失败；`path` 以点分隔（如 `items.0.title`）。
 */
export const FieldErrorSchema = z
  .object({
    path: z.string().openapi({ example: "title" }),
    message: z.string().openapi({ example: "Must contain at least 1 character" }),
  })
  .openapi("FieldError");

/**
 * RFC 9457 problem details. `traceId` lets users quote an error in bug reports
 * so it can be matched to logs and traces without exposing internals.
 *
 * RFC 9457 错误详情。用户反馈问题时可以提供 `traceId`，据此在日志和链路中定位，
 * 而响应本身不暴露任何内部细节。
 */
export const ProblemSchema = z
  .object({
    type: z.string().openapi({ example: "about:blank" }),
    title: z.string().openapi({ example: "Not Found" }),
    status: z.number().int().min(400).max(599).openapi({ example: 404 }),
    detail: z.string().optional(),
    instance: z.string().optional(),
    traceId: z.string().optional(),
    errors: z.array(FieldErrorSchema).optional(),
  })
  .openapi("Problem");

/** RFC 9457 problem details. 错误详情。 */
export type Problem = z.infer<typeof ProblemSchema>;
/** One field-level validation failure. 单个字段校验失败。 */
export type FieldError = z.infer<typeof FieldErrorSchema>;

/**
 * Builds an OpenAPI response entry whose body is a {@link ProblemSchema}.
 *
 * 生成一条响应体为 {@link ProblemSchema} 的 OpenAPI 响应定义。
 *
 * @param description - Shown in the API document. 显示在 API 文档中的说明。
 */
export const problemResponse = (description: string) => ({
  description,
  content: { [PROBLEM_CONTENT_TYPE]: { schema: ProblemSchema } },
});

/**
 * The 429 response of a rate-limited route, including its `Retry-After` header.
 *
 * 受限流保护的路由的 429 响应定义，包含 `Retry-After` 响应头。
 */
export const rateLimitedResponse = () => ({
  ...problemResponse("Too many requests; retry after the number of seconds in Retry-After"),
  headers: z.object({
    "Retry-After": z.string().openapi({ description: "Seconds to wait before retrying." }),
  }),
});
