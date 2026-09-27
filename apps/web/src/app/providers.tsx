"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { ApiError } from "@/lib/api";

const shouldRetry = (failureCount: number, error: unknown) => {
  // 4xx answers will not change on retry; only retry network errors and 5xx.
  if (error instanceof ApiError && error.status < 500) return false;
  return failureCount < 2;
};

/**
 * Client-side providers (React Query) for the whole app.
 *
 * 整个应用的客户端提供者（React Query）。
 */
export const Providers = ({ children }: { children: ReactNode }) => {
  // One client per browser session; useState keeps it stable across re-renders.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: shouldRetry },
          mutations: { retry: false },
        },
      }),
  );
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
