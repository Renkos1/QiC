"use client";

import type { Schemas } from "@qic/api-client";
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api";

/** A todo as returned by the API. API 返回的待办。 */
export type Todo = Schemas["Todo"];
type TodoPage = Schemas["TodoPage"];
type TodoPages = InfiniteData<TodoPage, string | undefined>;

/** Todos fetched per page. 每页加载的待办数。 */
export const PAGE_SIZE = 20;
const todosKey = ["todos"] as const;

/**
 * Infinite query over `GET /todos`, newest first.
 *
 * `GET /todos` 的无限查询，按新到旧。
 */
export const useTodos = () =>
  useInfiniteQuery({
    queryKey: todosKey,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      unwrap(
        api.GET("/todos", {
          params: { query: { limit: PAGE_SIZE, ...(pageParam && { cursor: pageParam }) } },
        }),
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

/**
 * Optional features of this deployment (e.g. whether AI is configured).
 *
 * 当前部署的可选功能（例如是否配置了 AI）。
 */
export const useCapabilities = () =>
  useQuery({
    queryKey: ["capabilities"],
    queryFn: () => unwrap(api.GET("/capabilities")),
    staleTime: Number.POSITIVE_INFINITY,
  });

/** Applies `change` to every cached page; used for optimistic updates. 把改动应用到所有已缓存的页，用于乐观更新。 */
const mapPages = (data: TodoPages | undefined, change: (items: Todo[]) => Todo[]) =>
  data && { ...data, pages: data.pages.map((page) => ({ ...page, items: change(page.items) })) };

/** Snapshot-and-rollback wiring shared by the optimistic mutations. 乐观更新共用的快照与回滚逻辑。 */
const useOptimistic = () => {
  const queryClient = useQueryClient();
  return {
    apply: async (change: (items: Todo[]) => Todo[]) => {
      await queryClient.cancelQueries({ queryKey: todosKey });
      const previous = queryClient.getQueryData<TodoPages>(todosKey);
      queryClient.setQueryData<TodoPages>(todosKey, (data) => mapPages(data, change));
      return { previous };
    },
    rollback: (context: { previous: TodoPages | undefined } | undefined) => {
      if (context) queryClient.setQueryData(todosKey, context.previous);
    },
    refresh: () => queryClient.invalidateQueries({ queryKey: todosKey }),
  };
};

/**
 * Creates a todo with a fresh `Idempotency-Key` per submission; refetches the list on success.
 *
 * 创建待办：每次提交生成新的 `Idempotency-Key`，服务端可对网络重试去重；成功后重新拉取列表（不做乐观插入）。
 */
export const useCreateTodo = () => {
  const queryClient = useQueryClient();
  return useMutation({
    // A fresh key per submission lets the server de-duplicate network retries.
    mutationFn: (title: string) =>
      unwrap(
        api.POST("/todos", {
          body: { title },
          params: { header: { "idempotency-key": crypto.randomUUID() } },
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: todosKey }),
  });
};

/**
 * Updates a todo optimistically.
 *
 * 乐观地更新待办。
 */
export const useUpdateTodo = () => {
  const optimistic = useOptimistic();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Schemas["UpdateTodo"] }) =>
      unwrap(api.PATCH("/todos/{id}", { params: { path: { id } }, body: patch })),
    onMutate: ({ id, patch }) =>
      optimistic.apply((items) =>
        items.map((todo) => (todo.id === id ? { ...todo, ...patch } : todo)),
      ),
    onError: (_error, _variables, context) => optimistic.rollback(context),
    onSettled: optimistic.refresh,
  });
};

/**
 * Deletes a todo optimistically.
 *
 * 乐观地删除待办。
 */
export const useDeleteTodo = () => {
  const optimistic = useOptimistic();
  return useMutation({
    mutationFn: (id: string) => unwrap(api.DELETE("/todos/{id}", { params: { path: { id } } })),
    onMutate: (id) => optimistic.apply((items) => items.filter((todo) => todo.id !== id)),
    onError: (_error, _variables, context) => optimistic.rollback(context),
    onSettled: optimistic.refresh,
  });
};

/**
 * Asks the API for AI suggestions; nothing is saved.
 *
 * 向 API 请求 AI 拆分建议；不会保存任何数据。
 */
export const useSuggestTodos = () =>
  useMutation({
    mutationFn: (text: string) => unwrap(api.POST("/todos/suggestions", { body: { text } })),
  });
