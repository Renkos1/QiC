import { type Database, type TodoRow, todos } from "@qic/db";
import { and, desc, eq, lt, or } from "drizzle-orm";
import type { TodoCursor } from "./schema.js";

/**
 * Persistence of todos. Every method takes the owner's `userId`.
 *
 * 待办的持久化接口。每个方法都要求传入所有者的 `userId`。
 */
export interface TodoRepo {
  /** Returns up to `limit` rows after `cursor`, newest first. 返回 `cursor` 之后最多 `limit` 行，按新到旧。 */
  list: (
    userId: string,
    options: { cursor: TodoCursor | null; limit: number },
  ) => Promise<TodoRow[]>;
  /** The user's todo with `id`, if any. 查询该用户的指定待办，不存在时为 undefined。 */
  findById: (userId: string, id: string) => Promise<TodoRow | undefined>;
  /** Inserts a todo and returns the stored row. 插入待办并返回存储后的行。 */
  insert: (userId: string, values: { title: string }) => Promise<TodoRow>;
  /** Applies a partial update; undefined when the todo is not the user's. 部分更新；待办不属于该用户时返回 undefined。 */
  update: (
    userId: string,
    id: string,
    patch: { title?: string | undefined; completed?: boolean | undefined },
  ) => Promise<TodoRow | undefined>;
  /** Deletes the todo; false when it is not the user's. 删除待办；不属于该用户时返回 false。 */
  remove: (userId: string, id: string) => Promise<boolean>;
}

/**
 * The only code that touches the todos table. Every query is scoped by userId, so
 * a todo owned by someone else is indistinguishable from one that does not exist.
 *
 * 唯一直接访问 todos 表的代码。所有查询都按 `userId` 限定范围，
 * 因此别人的待办与不存在的待办无法区分（不泄露存在性）。
 *
 * @param db - Database handle. 数据库。
 */
export const createTodoRepo = (db: Database): TodoRepo => ({
  list: (userId, { cursor, limit }) =>
    db
      .select()
      .from(todos)
      .where(
        and(
          eq(todos.userId, userId),
          cursor
            ? or(
                lt(todos.createdAt, cursor.createdAt),
                and(eq(todos.createdAt, cursor.createdAt), lt(todos.id, cursor.id)),
              )
            : undefined,
        ),
      )
      .orderBy(desc(todos.createdAt), desc(todos.id))
      .limit(limit),

  findById: async (userId, id) => {
    const [row] = await db
      .select()
      .from(todos)
      .where(and(eq(todos.userId, userId), eq(todos.id, id)));
    return row;
  },

  insert: async (userId, { title }) => {
    const [row] = await db.insert(todos).values({ userId, title }).returning();
    if (!row) throw new Error("insert returned no row");
    return row;
  },

  update: async (userId, id, patch) => {
    const [row] = await db
      .update(todos)
      .set(patch)
      .where(and(eq(todos.userId, userId), eq(todos.id, id)))
      .returning();
    return row;
  },

  remove: async (userId, id) => {
    const deleted = await db
      .delete(todos)
      .where(and(eq(todos.userId, userId), eq(todos.id, id)))
      .returning({ id: todos.id });
    return deleted.length > 0;
  },
});
