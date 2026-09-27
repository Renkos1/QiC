import { z } from "../openapi-zod.js";

/**
 * Page size when the client does not pass `limit`.
 *
 * 客户端未传 `limit` 时的默认每页条数。
 */
export const DEFAULT_PAGE_LIMIT = 20;
/**
 * Largest accepted `limit`; bounds query cost.
 *
 * 允许的最大 `limit`，用于限制单次查询开销。
 */
export const MAX_PAGE_LIMIT = 100;

/**
 * Query parameters for cursor-based pagination. The cursor is opaque to clients.
 *
 * 游标分页的查询参数。游标对客户端是不透明的字符串，只能原样回传，不要解析。
 */
export const CursorQuerySchema = z.object({
  cursor: z
    .string()
    .min(1)
    .optional()
    .openapi({
      param: { name: "cursor", in: "query" },
      description: "Opaque cursor from a previous page.",
    }),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_LIMIT)
    .default(DEFAULT_PAGE_LIMIT)
    .openapi({ param: { name: "limit", in: "query" }, example: DEFAULT_PAGE_LIMIT }),
});

/** Parsed pagination query. 解析后的分页参数。 */
export type CursorQuery = z.infer<typeof CursorQuerySchema>;

/**
 * Wraps an item schema in a page envelope. `nextCursor` is null on the last page.
 *
 * 把条目 schema 包装成分页结构 `{ items, nextCursor }`；最后一页的 `nextCursor` 为 null。
 *
 * @param item - Schema of one item. 单个条目的 schema。
 * @param name - Component name registered in the OpenAPI document. 在 OpenAPI 文档中注册的组件名。
 */
export const paginated = <T extends z.ZodType>(item: T, name: string) =>
  z
    .object({
      items: z.array(item),
      nextCursor: z.string().nullable(),
    })
    .openapi(name);
