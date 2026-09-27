import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach } from "vitest";

// Vitest runs without globals, so Testing Library cannot register its own cleanup.
afterEach(cleanup);

/**
 * Renders `ui` inside a fresh React Query client with retries off, so failures surface at once.
 *
 * 在全新的 React Query 客户端中渲染组件（关闭重试，失败立即可见）；每个测试互不共享缓存。
 *
 * @param ui - Element under test. 被测元素。
 * @returns Testing Library helpers plus the query client. Testing Library 工具及查询客户端。
 */
export const renderWithQuery = (ui: ReactNode) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    client,
    ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>),
  };
};

/**
 * Builds an openapi-fetch result: `data` on 2xx, `error` otherwise.
 *
 * 构造 openapi-fetch 的返回结构：2xx 时带 `data`，否则带 `error`。
 *
 * @param status - HTTP status. HTTP 状态码。
 * @param body - Response body. 响应体。
 */
export const fetchResult = (status: number, body?: unknown) => ({
  data: status < 300 ? body : undefined,
  error: status >= 300 ? body : undefined,
  response: new Response(null, { status }),
});

/**
 * A todo as the API returns it.
 *
 * 构造一条 API 格式的待办。
 *
 * @param overrides - Fields to change. 需要覆盖的字段。
 */
export const aTodo = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "0b8a3f5e-6c1d-4a8e-9f3b-2d7c1e5a9b40",
  title: "买牛奶",
  completed: false,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  ...overrides,
});
