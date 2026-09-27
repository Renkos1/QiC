"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Browser auth client. With no baseURL it targets the current origin at /api/auth,
 * which the Next rewrite proxies to apps/api.
 *
 * 浏览器端 Better Auth 客户端。不设 baseURL 时请求当前源的 `/api/auth`，由 Next 的 rewrite 代理到 apps/api。
 */
export const authClient = createAuthClient();
