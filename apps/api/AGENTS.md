# apps/api — AGENTS.md

> 只写与根目录 AGENTS.md 不同或更具体的内容。分层说明与调试手册见 [docs/developer-guide.md](../../docs/developer-guide.md)。

- **职责**：对外 HTTP API（NestJS + Express 适配器）。不包含 UI 逻辑，不在请求中执行慢操作（发邮件等投递到 worker）。
- **入口**：`src/instrument.ts`（OpenTelemetry，经 `--import` 预加载）→ `src/main.ts`（创建基础设施、启动、按顺序停机）；HTTP 管道在 `src/http-app.ts`，服务和测试共用。
- **模块结构**：`src/modules/<域>/` 下为 `<域>.controller.ts / <域>.module.ts / service.ts / repo.ts / schema.ts / index.ts`。
  - 控制器只做契约绑定与鉴权；服务是**不依赖 Nest 的纯函数工厂**，副作用全部通过参数注入；仓储是唯一访问本域数据表的代码。
  - 其他模块只能从 `index.ts` 导入（dependency-cruiser 强制）。
- **依赖注入**：一律 `@Inject(TOKEN)`，令牌在 `src/tokens.ts` 声明。不要依赖按类型自动注入：构建链路（tsx、Vitest、TS 7）不生成 `emitDecoratorMetadata`，自动注入会得到 `undefined`。
- **契约绑定**：路由用 `@ContractRoute(route)`，输入用 `@ContractBody/Query/Params/Headers(route)`（`src/http/contract.ts`）。不要手写 `@Get("...")` 路径或自行校验，以免与 `openapi.json` 漂移。
- **错误**：抛 `ProblemError(status, { detail })`，由全局 `ProblemFilter` 转成 RFC 9457；`detail` 会返回给用户，不能含内部信息。其他异常一律返回 500，并经 `ErrorReporter`（Sentry）上报。
- **队列生产者**：新建 `Queue` 时展开 `queueBaseOptions(redisUrl)`（`src/queue/options.ts`），保证 trace 上下文传给 worker。
- **Bull Board**：`src/admin/bull-board.ts`，只在 `NODE_ENV=development` 时挂载到 `/admin/queues`（无鉴权，不能暴露到生产）。
- **新增接口**：契约 → `pnpm gen` → 服务（先写单元测试）→ 控制器 → 集成测试（`src/app.int.test.ts`）。
- **测试**：`pnpm --filter @qic/api test`（单元，含 HTTP 管道的 Nest 测试模块）、`pnpm --filter @qic/api test:int`（Testcontainers，需要 Docker）。
- **本地端口**：开发 14000；e2e 14200；调试 `pnpm --filter @qic/api dev:inspect` 监听 9229。
