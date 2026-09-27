import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth.js";

/**
 * Todos of the reference example module. Every query must be scoped by `userId`.
 *
 * 示例模块的待办表。所有查询都必须按 `userId` 过滤，保证用户之间数据隔离。
 */
export const todos = pgTable(
  "todos",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text().notNull(),
    completed: boolean().notNull().default(false),
    // Millisecond precision so (createdAt, id) keyset cursors round-trip through JS Date exactly.
    createdAt: timestamp({ withTimezone: true, precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  // Serves the per-user list ordered newest first with (createdAt, id) keyset cursors.
  (t) => [index().on(t.userId, t.createdAt.desc(), t.id.desc())],
);

/** A selected todo row. 查询得到的一行待办。 */
export type TodoRow = typeof todos.$inferSelect;
/** Values for inserting a todo. 插入待办时的字段。 */
export type NewTodoRow = typeof todos.$inferInsert;
