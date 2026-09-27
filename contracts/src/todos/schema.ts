import { paginated } from "../common/pagination.js";
import { z } from "../openapi-zod.js";

/**
 * Maximum length of a todo title, shared by the api, the web form and the AI prompt.
 *
 * 待办标题的最大长度；API、前端表单和 AI 提示词共用同一个值。
 */
export const TODO_TITLE_MAX = 200;

/**
 * A todo as returned by the API. Timestamps are ISO 8601 strings with millisecond precision.
 *
 * API 返回的待办。时间戳为毫秒精度的 ISO 8601 字符串。
 */
export const TodoSchema = z
  .object({
    id: z.uuid().openapi({ example: "0b8a3f5e-6c1d-4a8e-9f3b-2d7c1e5a9b40" }),
    title: z.string().min(1).max(TODO_TITLE_MAX).openapi({ example: "Buy milk" }),
    completed: z.boolean(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("Todo");

/**
 * Request body of `POST /todos`. The title is trimmed before length checks.
 *
 * `POST /todos` 的请求体。标题先去除首尾空白再校验长度。
 */
export const CreateTodoSchema = z
  .object({
    title: z.string().trim().min(1).max(TODO_TITLE_MAX),
  })
  .openapi("CreateTodo");

/**
 * Request body of `PATCH /todos/{id}`: a partial update that must change at least one field.
 *
 * `PATCH /todos/{id}` 的请求体：部分更新，至少要包含一个字段。
 */
export const UpdateTodoSchema = z
  .object({
    title: z.string().trim().min(1).max(TODO_TITLE_MAX).optional(),
    completed: z.boolean().optional(),
  })
  .refine((body) => body.title !== undefined || body.completed !== undefined, {
    message: "At least one field must be provided",
  })
  .openapi("UpdateTodo");

/**
 * Path parameters of `/todos/{id}`; a non-UUID id is rejected with 400 before any lookup.
 *
 * `/todos/{id}` 的路径参数；非 UUID 的 id 在查库前就以 400 拒绝。
 */
export const TodoIdParamSchema = z.object({
  id: z.uuid().openapi({ param: { name: "id", in: "path" } }),
});

/**
 * One page of the caller's todos, newest first.
 *
 * 当前用户待办的一页数据，按创建时间倒序。
 */
export const TodoPageSchema = paginated(TodoSchema, "TodoPage");

/**
 * Maximum length of the free text sent to `POST /todos/suggestions`; bounds AI cost.
 *
 * 发给 `POST /todos/suggestions` 的自由文本最大长度，用于限制 AI 调用成本。
 */
export const SUGGESTION_TEXT_MAX = 1_000;

/**
 * Request body of `POST /todos/suggestions`: free text for the AI to split into todos.
 *
 * `POST /todos/suggestions` 的请求体：交给 AI 拆分成待办的自由文本。
 */
export const SuggestTodosSchema = z
  .object({
    text: z.string().trim().min(1).max(SUGGESTION_TEXT_MAX).openapi({
      example: "周末打扫房间，顺便把旧衣服捐掉，再约朋友吃饭",
    }),
  })
  .openapi("SuggestTodos");

/**
 * Response of `POST /todos/suggestions`.
 *
 * `POST /todos/suggestions` 的响应。
 */
export const TodoSuggestionsSchema = z
  .object({
    /**
     * Suggested titles; nothing is created until the client posts them to `/todos`.
     *
     * 建议的标题；客户端逐条提交到 `/todos` 之前不会创建任何待办。
     */
    titles: z.array(z.string().min(1).max(TODO_TITLE_MAX)).min(1),
  })
  .openapi("TodoSuggestions");

/** A todo as returned by the API. API 返回的待办。 */
export type Todo = z.infer<typeof TodoSchema>;
/** Body of `POST /todos/suggestions`. AI 拆分请求体。 */
export type SuggestTodos = z.infer<typeof SuggestTodosSchema>;
/** Response of `POST /todos/suggestions`. AI 拆分结果。 */
export type TodoSuggestions = z.infer<typeof TodoSuggestionsSchema>;
/** Body of `POST /todos` (after trimming). 创建待办的请求体（已去空白）。 */
export type CreateTodo = z.infer<typeof CreateTodoSchema>;
/** Body of `PATCH /todos/{id}`. 更新待办的请求体。 */
export type UpdateTodo = z.infer<typeof UpdateTodoSchema>;
/** One page of todos. 一页待办。 */
export type TodoPage = z.infer<typeof TodoPageSchema>;
