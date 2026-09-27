<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# apps/web — AGENTS.md

> 上面的区块由 `next dev` 自动维护，不要修改；本节只写与根目录 AGENTS.md 不同或更具体的内容。分层说明见 [docs/developer-guide.md](../../docs/developer-guide.md)。

- **职责**：Next.js App Router 前端。只通过同源 `/api`（开发时由 `next.config.ts` 的 rewrites 代理，部署时由 Caddy 路由）访问后端；不直接访问数据库或 Redis。
- **目录**：`src/app/**` 路由（`(auth)` 为公开的账号页面，`(app)` 需登录）；`src/features/<功能>/` 功能模块（组件 + hooks + 测试）；`src/components/` 通用组件；`src/lib/` 客户端工具。UI 基础组件来自 `@qic/ui`。
- **鉴权**：`src/proxy.ts`（Next 16 的 proxy，替代 middleware）只做“有无会话 Cookie”的乐观跳转；受保护页面必须在服务端调用 `getServerSession()`（`src/lib/session.ts`）。新增公开路径时同步修改 `proxy.ts` 的 `matcher`。
- **数据获取**：客户端用 `@qic/api-client` + React Query；错误统一经 `src/lib/api.ts` 转成用户可读的文案。登录、退出后用 `hardNavigate()` 整页跳转（避免 prefetch 缓存旧的跳转结果）。
- **表单**：react-hook-form + zod；提交按钮在水合前保持禁用（`useHydrated()`），防止原生 GET 提交把字段带进 URL。
- **环境变量**：服务端变量经 `getServerEnv()`（`src/env.ts`）在运行时读取，同一镜像可跨环境；浏览器只能读取构建时写入的 `NEXT_PUBLIC_*`。
- **可观测性**：`src/instrumentation.ts`（服务端：@vercel/otel、Sentry）与 `src/instrumentation-client.ts`（浏览器：构建时开关）；浏览器 span 经 `/otlp/v1/traces` 中转到采集器。
- **测试**：组件测试在文件首行写 `// @vitest-environment jsdom`，用 `src/test/render.tsx`；网络只通过 `vi.mock("@/lib/api")` 替换。
- **本地端口**：开发 13000；e2e 13200。
