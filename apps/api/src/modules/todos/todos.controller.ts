import type { ServerResponse } from "node:http";
import { Controller, Inject, Res, UseGuards } from "@nestjs/common";
import {
  type CreateTodo,
  type CursorQuery,
  createTodoRoute,
  deleteTodoRoute,
  getTodoRoute,
  listTodosRoute,
  type SuggestTodos,
  suggestTodosRoute,
  type Todo,
  type TodoPage,
  type TodoSuggestions,
  type UpdateTodo,
  updateTodoRoute,
} from "@qic/contracts";
import type { Actor } from "../../auth/actor.js";
import { CurrentActor, SessionGuard } from "../../auth/session.guard.js";
import {
  ContractBody,
  ContractHeaders,
  ContractParams,
  ContractQuery,
  ContractRoute,
} from "../../http/contract.js";
import { RateLimit } from "../../http/rate-limit.js";
import { TODO_SERVICE } from "../../tokens.js";
import type { TodoService } from "./service.js";

/**
 * HTTP layer only: contract binding, auth, and mapping to the service.
 *
 * 只负责 HTTP 层：绑定契约、鉴权，并把请求映射到服务；业务逻辑都在 service 中。
 */
@Controller()
@UseGuards(SessionGuard)
export class TodosController {
  constructor(@Inject(TODO_SERVICE) private readonly service: TodoService) {}

  /** `GET /api/todos`. 分页列出待办。 */
  @ContractRoute(listTodosRoute)
  list(
    @CurrentActor() actor: Actor,
    @ContractQuery(listTodosRoute) query: CursorQuery,
  ): Promise<TodoPage> {
    return this.service.list(actor, query);
  }

  /** `POST /api/todos`; sets `Idempotent-Replayed` on a replay. 创建待办；重放时设置 `Idempotent-Replayed` 响应头。 */
  @ContractRoute(createTodoRoute)
  async create(
    @CurrentActor() actor: Actor,
    @ContractHeaders(createTodoRoute) headers: { "idempotency-key"?: string | undefined },
    @ContractBody(createTodoRoute) body: CreateTodo,
    @Res({ passthrough: true }) response: ServerResponse,
  ): Promise<Todo> {
    const { todo, replayed } = await this.service.create(actor, body, headers["idempotency-key"]);
    if (replayed) response.setHeader("Idempotent-Replayed", "true");
    return todo;
  }

  /** `POST /api/todos/suggestions`. AI 拆分建议。 */
  @ContractRoute(suggestTodosRoute)
  // Every AI call costs money; the "ai" budget is shared by all AI endpoints.
  @RateLimit({ name: "ai", max: 10, window: 60, by: "user" })
  async suggest(@ContractBody(suggestTodosRoute) body: SuggestTodos): Promise<TodoSuggestions> {
    return { titles: await this.service.suggest(body.text) };
  }

  /** `GET /api/todos/{id}`. 查询单条待办。 */
  @ContractRoute(getTodoRoute)
  get(
    @CurrentActor() actor: Actor,
    @ContractParams(getTodoRoute) params: { id: string },
  ): Promise<Todo> {
    return this.service.get(actor, params.id);
  }

  /** `PATCH /api/todos/{id}`. 更新待办。 */
  @ContractRoute(updateTodoRoute)
  update(
    @CurrentActor() actor: Actor,
    @ContractParams(updateTodoRoute) params: { id: string },
    @ContractBody(updateTodoRoute) body: UpdateTodo,
  ): Promise<Todo> {
    return this.service.update(actor, params.id, body);
  }

  /** `DELETE /api/todos/{id}`. 删除待办。 */
  @ContractRoute(deleteTodoRoute)
  async remove(
    @CurrentActor() actor: Actor,
    @ContractParams(deleteTodoRoute) params: { id: string },
  ): Promise<void> {
    await this.service.remove(actor, params.id);
  }
}
