"use client";

import { Button } from "@qic/ui/components/button";
import { Skeleton } from "@qic/ui/components/skeleton";
import { FormAlert } from "@/components/FormAlert";
import { apiErrorMessage } from "@/lib/api";
import { TodoItem } from "./TodoItem";
import { useTodos } from "./use-todos";

const LoadingState = () => (
  <ul aria-busy="true" aria-label="正在加载待办" className="grid gap-px">
    {[0, 1, 2].map((row) => (
      <li key={row} className="flex h-14 items-center gap-3 border-b px-4 last:border-b-0">
        <Skeleton className="size-4" />
        <Skeleton className="h-4 flex-1" />
      </li>
    ))}
  </ul>
);

const EmptyState = () => (
  <div className="grid place-items-center gap-2 px-6 py-14 text-center">
    <span className="journal-kicker">NO ENTRIES / 0</span>
    <p className="text-muted-foreground">还没有待办。在上方写下第一件要做的事吧。</p>
  </div>
);

/**
 * Infinite list of the user's todos with loading, empty and error states.
 *
 * 当前用户待办的无限滚动列表，包含加载、空和错误状态。
 */
export const TodoList = () => {
  const { data, error, isPending, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useTodos();

  if (isPending) return <LoadingState />;

  if (error) {
    return (
      <div className="grid gap-3 p-4">
        <FormAlert message={`加载失败：${apiErrorMessage(error)}`} />
        <Button variant="outline" onClick={() => refetch()} className="justify-self-start">
          重试
        </Button>
      </div>
    );
  }

  const todos = data.pages.flatMap((page) => page.items);
  if (todos.length === 0) return <EmptyState />;

  return (
    <>
      <ul aria-label="待办列表">
        {todos.map((todo) => (
          <TodoItem key={todo.id} todo={todo} />
        ))}
      </ul>
      {hasNextPage && (
        <div className="border-t p-3 text-center">
          <Button variant="ghost" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? "正在加载…" : "加载更多"}
          </Button>
        </div>
      )}
    </>
  );
};
