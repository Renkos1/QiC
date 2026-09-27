import type {
  CreateTodo,
  CursorQuery,
  Todo,
  TodoCompletedJob,
  TodoPage,
  UpdateTodo,
} from "@qic/contracts";
import type { Logger } from "@qic/logger";
import type { Actor } from "../../auth/actor.js";
import { ProblemError } from "../../http/problem.js";
import { fingerprintOf, type IdempotencyStore } from "../../lib/idempotency.js";
import type { TodoRepo } from "./repo.js";
import { decodeCursor, encodeCursor, toTodoDto } from "./schema.js";

/**
 * Dependencies of {@link createTodoService}; all side effects are injected.
 *
 * {@link createTodoService} 的依赖；所有副作用都通过注入提供，便于单元测试。
 */
export interface TodoServiceDeps {
  /** Persistence. 持久化。 */
  repo: TodoRepo;
  /** Claims for `Idempotency-Key`. 幂等键存储。 */
  idempotency: IdempotencyStore;
  /** Enqueues the completion notification; the worker sends it. 投递完成通知，由 worker 发送。 */
  notifyCompleted: (job: TodoCompletedJob) => Promise<void>;
  /** Splits free text into titles, or null when AI is not configured. AI 拆分函数；未配置 AI 时为 null。 */
  suggestTitles: ((text: string) => Promise<string[]>) | null;
  /** Web app URL used in notification links. 通知邮件中链接到的 web 地址。 */
  todosUrl: string;
  /** Logs enqueue and AI failures. 记录投递和 AI 失败。 */
  logger: Logger;
}

const notFound = () => new ProblemError(404, { detail: "Todo not found" });

/**
 * Creates the todo service: cursor pagination, idempotent create, completion notifications
 * and AI suggestions. Framework-free, so it is unit tested without Nest.
 *
 * 创建待办服务：游标分页、幂等创建、完成通知和 AI 拆分建议。
 * 不依赖框架，单元测试无需启动 Nest。所有错误以 {@link ProblemError} 抛出。
 *
 * @param deps - Repository, idempotency store and side effects. 仓储、幂等存储与副作用。
 */
export const createTodoService = ({
  repo,
  idempotency,
  notifyCompleted,
  suggestTitles,
  todosUrl,
  logger,
}: TodoServiceDeps) => ({
  /**
   * Lists the actor's todos, newest first.
   *
   * 列出当前用户的待办，按新到旧分页。
   *
   * @throws {ProblemError} 400 for a cursor this API did not issue. 游标无效时抛 400。
   */
  list: async (actor: Actor, { cursor, limit }: CursorQuery): Promise<TodoPage> => {
    const after = cursor === undefined ? null : decodeCursor(cursor);
    if (cursor !== undefined && !after) {
      throw new ProblemError(400, { errors: [{ path: "cursor", message: "Invalid cursor" }] });
    }
    // Fetch one extra row to know whether another page exists without a COUNT query.
    const rows = await repo.list(actor.id, { cursor: after, limit: limit + 1 });
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      items: page.map(toTodoDto),
      nextCursor: rows.length > limit && last ? encodeCursor(last) : null,
    };
  },

  /**
   * Returns one of the actor's todos.
   *
   * 返回当前用户的一条待办。
   *
   * @throws {ProblemError} 404 when missing or not the actor's. 不存在或不属于该用户时抛 404。
   */
  get: async (actor: Actor, id: string): Promise<Todo> => {
    const row = await repo.findById(actor.id, id);
    if (!row) throw notFound();
    return toTodoDto(row);
  },

  /**
   * Creates a todo. With an idempotency key, a retried request returns the original
   * todo instead of creating a duplicate (`replayed: true`).
   *
   * 创建待办。带幂等键时，重试的请求返回原来的待办而不是重复创建（`replayed: true`）。
   * 幂等键按用户隔离；插入失败时释放幂等键，客户端可以用同一个键重试。
   *
   * @throws {ProblemError} 409 while the same key is in flight; 422 when the key was used with a different body.
   *   同一键的请求仍在处理时抛 409；同一键配不同请求体时抛 422。
   */
  create: async (
    actor: Actor,
    input: CreateTodo,
    idempotencyKey?: string,
  ): Promise<{ todo: Todo; replayed: boolean }> => {
    if (!idempotencyKey) {
      return { todo: toTodoDto(await repo.insert(actor.id, input)), replayed: false };
    }
    // Keys are per user so one user's key can never replay another user's todo.
    const key = `${actor.id}:${idempotencyKey}`;
    const fingerprint = fingerprintOf(input);
    const claim = await idempotency.begin<Todo>(key, fingerprint);
    switch (claim.status) {
      case "replay":
        return { todo: claim.value, replayed: true };
      case "in-progress":
        throw new ProblemError(409, {
          detail: "A request with this Idempotency-Key is in progress",
        });
      case "mismatch":
        throw new ProblemError(422, {
          detail: "Idempotency-Key was already used with a different request body",
        });
      case "new":
        break;
    }
    try {
      const todo = toTodoDto(await repo.insert(actor.id, input));
      await idempotency.complete(key, fingerprint, todo);
      return { todo, replayed: false };
    } catch (error) {
      await idempotency.release(key);
      throw error;
    }
  },

  /**
   * Applies a partial update. The first open→completed transition enqueues a notification;
   * an enqueue failure is logged, never returned to the caller.
   *
   * 部分更新待办。首次由未完成变为已完成时投递通知；投递失败只记录日志，不影响本次更新的结果。
   *
   * @throws {ProblemError} 404 when missing or not the actor's. 不存在或不属于该用户时抛 404。
   */
  update: async (actor: Actor, id: string, patch: UpdateTodo): Promise<Todo> => {
    const before = await repo.findById(actor.id, id);
    if (!before) throw notFound();
    // Read before updating: the repo may hand back the same object it later mutates.
    const wasCompleted = before.completed;
    const after = await repo.update(actor.id, id, patch);
    if (!after) throw notFound();

    if (!wasCompleted && after.completed) {
      // The update is already committed; a failed enqueue must not turn it into an error.
      // Known gap: a notification is lost if Redis is down at this moment. A transactional
      // outbox would close it; not needed for an example notification.
      notifyCompleted({
        todoId: after.id,
        userId: actor.id,
        title: after.title,
        to: actor.email,
        name: actor.name,
        url: todosUrl,
      }).catch((error: unknown) => {
        logger.error({ err: error, todoId: after.id }, "failed to enqueue todo-completed");
      });
    }
    return toTodoDto(after);
  },

  /**
   * Deletes one of the actor's todos.
   *
   * 删除当前用户的一条待办。
   *
   * @throws {ProblemError} 404 when missing or not the actor's. 不存在或不属于该用户时抛 404。
   */
  remove: async (actor: Actor, id: string): Promise<void> => {
    if (!(await repo.remove(actor.id, id))) throw notFound();
  },

  /**
   * Asks the AI to split free text into todo titles; saves nothing.
   *
   * 请 AI 把自由文本拆分为待办标题；不保存任何数据。
   *
   * @throws {ProblemError} 503 when AI is not configured or the call fails. 未配置 AI 或调用失败时抛 503。
   */
  suggest: async (text: string): Promise<string[]> => {
    if (!suggestTitles) {
      throw new ProblemError(503, { detail: "AI features are not configured on this server" });
    }
    try {
      return await suggestTitles(text);
    } catch (error) {
      logger.warn({ err: error }, "todo suggestion failed");
      throw new ProblemError(503, { detail: "AI is temporarily unavailable, try again later" });
    }
  },
});

/** The todo domain service. 待办领域服务。 */
export type TodoService = ReturnType<typeof createTodoService>;
