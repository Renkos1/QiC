import { CursorQuerySchema } from "../common/pagination.js";
import { problemResponse, rateLimitedResponse } from "../common/problem.js";
import { defineRoute, z } from "../openapi-zod.js";
import {
  CreateTodoSchema,
  SuggestTodosSchema,
  TodoIdParamSchema,
  TodoPageSchema,
  TodoSchema,
  TodoSuggestionsSchema,
  UpdateTodoSchema,
} from "./schema.js";

const tags = ["todos"];
const security = [{ cookieAuth: [] }];

const commonErrors = {
  401: problemResponse("Not signed in"),
  500: problemResponse("Unexpected server error"),
} as const;

const json = <T extends z.ZodType>(schema: T) => ({ "application/json": { schema } });

const IdempotencyHeaderSchema = z.object({
  "idempotency-key": z
    .string()
    .min(1)
    .max(255)
    .optional()
    .openapi({
      // Header names are case-insensitive; Node exposes them lowercased.
      param: { name: "idempotency-key", in: "header" },
      description:
        "Retries with the same key return the original result instead of creating a duplicate.",
    }),
});

/**
 * `GET /todos`: the caller's todos, newest first, cursor-paginated.
 *
 * `GET /todos`：当前用户的待办，按创建时间倒序，游标分页。
 */
export const listTodosRoute = defineRoute({
  operationId: "listTodos",
  method: "get",
  path: "/todos",
  tags,
  security,
  request: { query: CursorQuerySchema },
  responses: {
    200: { description: "A page of the current user's todos", content: json(TodoPageSchema) },
    400: problemResponse("Invalid query parameters"),
    ...commonErrors,
  },
});

/**
 * `POST /todos`: creates a todo; an `Idempotency-Key` makes retries safe.
 *
 * `POST /todos`：创建待办；携带 `Idempotency-Key` 时重试不会产生重复数据（重放时响应头带 `Idempotent-Replayed: true`）。
 */
export const createTodoRoute = defineRoute({
  operationId: "createTodo",
  method: "post",
  path: "/todos",
  tags,
  security,
  request: {
    headers: IdempotencyHeaderSchema,
    body: { required: true, content: json(CreateTodoSchema) },
  },
  responses: {
    201: { description: "Created", content: json(TodoSchema) },
    400: problemResponse("Invalid request body"),
    ...commonErrors,
  },
});

/**
 * `GET /todos/{id}`: one todo; another user's todo is reported as 404.
 *
 * `GET /todos/{id}`：单个待办；别人的待办一律返回 404，不暴露其是否存在。
 */
export const getTodoRoute = defineRoute({
  operationId: "getTodo",
  method: "get",
  path: "/todos/{id}",
  tags,
  security,
  request: { params: TodoIdParamSchema },
  responses: {
    200: { description: "The todo", content: json(TodoSchema) },
    404: problemResponse("Todo not found"),
    ...commonErrors,
  },
});

/**
 * `PATCH /todos/{id}`: partial update; completing a todo enqueues a notification email.
 *
 * `PATCH /todos/{id}`：部分更新；待办首次变为已完成时投递通知邮件。
 */
export const updateTodoRoute = defineRoute({
  operationId: "updateTodo",
  method: "patch",
  path: "/todos/{id}",
  tags,
  security,
  request: {
    params: TodoIdParamSchema,
    body: { required: true, content: json(UpdateTodoSchema) },
  },
  responses: {
    200: { description: "Updated", content: json(TodoSchema) },
    400: problemResponse("Invalid request body"),
    404: problemResponse("Todo not found"),
    ...commonErrors,
  },
});

/**
 * `DELETE /todos/{id}`: deletes the todo (204).
 *
 * `DELETE /todos/{id}`：删除待办，成功返回 204。
 */
export const deleteTodoRoute = defineRoute({
  operationId: "deleteTodo",
  method: "delete",
  path: "/todos/{id}",
  tags,
  security,
  request: { params: TodoIdParamSchema },
  responses: {
    204: { description: "Deleted" },
    404: problemResponse("Todo not found"),
    ...commonErrors,
  },
});

/**
 * `POST /todos/suggestions`: asks the AI to split free text into todo titles; saves nothing.
 *
 * `POST /todos/suggestions`：让 AI 把自由文本拆成待办标题，不保存任何数据；未配置 AI 或调用失败时返回 503；
 * 每个用户每分钟最多 10 次（与其他 AI 接口共享额度），超出返回 429。
 */
export const suggestTodosRoute = defineRoute({
  operationId: "suggestTodos",
  method: "post",
  path: "/todos/suggestions",
  tags,
  security,
  request: { body: { required: true, content: json(SuggestTodosSchema) } },
  responses: {
    200: {
      description: "Suggested todo titles (nothing is saved)",
      content: json(TodoSuggestionsSchema),
    },
    400: problemResponse("Invalid request body"),
    429: rateLimitedResponse(),
    503: problemResponse("AI is not configured or temporarily unavailable"),
    ...commonErrors,
  },
});

/**
 * All todo routes, in OpenAPI document order.
 *
 * 全部待办路由，顺序即 OpenAPI 文档中的顺序。
 */
export const todoRoutes = [
  listTodosRoute,
  createTodoRoute,
  suggestTodosRoute,
  getTodoRoute,
  updateTodoRoute,
  deleteTodoRoute,
] as const;
