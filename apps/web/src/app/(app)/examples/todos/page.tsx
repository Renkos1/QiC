import type { Metadata } from "next";
import { AddTodoForm } from "@/features/todos/AddTodoForm";
import { SuggestPanel } from "@/features/todos/SuggestPanel";
import { TodoList } from "@/features/todos/TodoList";

/** Browser tab title. 浏览器标签页标题。 */
export const metadata: Metadata = { title: "示例：待办" };

/**
 * Reference vertical slice, not a product feature: it exercises
 * contract → api → db → queue → worker → web end to end and is the template for real modules.
 *
 * 示例纵向切片，不是产品功能：完整演示 契约 → API → 数据库 → 队列 → worker → 前端 的链路，
 * 是实现真实业务模块时参照的模板。路由 `/examples/todos`。
 */
export default function TodosExamplePage() {
  return (
    <div className="grid gap-10">
      <header className="grid gap-3">
        <span className="journal-kicker">EXAMPLE / REFERENCE SLICE / TODOS</span>
        <h1 className="text-4xl leading-none sm:text-5xl">示例：待办</h1>
        <p className="max-w-prose text-muted-foreground">
          这是工程骨架的示例模块，用来演示完整链路：契约、API、数据库、队列、邮件通知与 AI
          结构化输出。真实的产品功能会参照它的结构实现。
        </p>
      </header>

      <section aria-label="待办" className="rounded-md border bg-card shadow-journal">
        <div className="border-b p-4">
          <AddTodoForm />
        </div>
        <TodoList />
      </section>

      <SuggestPanel />
    </div>
  );
}
