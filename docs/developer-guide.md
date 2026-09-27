# 开发者指南：分层、测试与调试

面向第一次接触本仓库的开发者。读完应能回答三个问题：一个请求经过了哪些层？改某一层时该写什么测试？出问题时从哪里查起？

命令的权威清单在 [AGENTS.md §2](../AGENTS.md#2-命令唯一入口不要自创命令或绕过脚本)，本文只在需要时引用。

## 1. 全局视图

```
浏览器
  │  同源请求：/、/sign-in、/api/*
  ▼
web（Next.js，apps/web）───── /api/* 重写（开发）或 Caddy 路由（部署）────┐
  │  服务端组件用 getServerSession() 向 api 校验会话                        │
  ▼                                                                         ▼
                                     api（NestJS，apps/api）
                                       ├─ /api/auth/*  → Better Auth
                                       ├─ /api/*       → 控制器 → 服务 → 仓储 → PostgreSQL
                                       └─ 副作用       → BullMQ 队列（Redis）
                                                            │
                                                            ▼
                                     worker（NestJS + BullMQ，apps/worker）→ SMTP（开发：Mailpit）
```

- **契约（`contracts/`）是唯一真相源**：zod schema 同时生成 `openapi.json`、web 使用的类型化客户端（`packages/api-client`），并驱动 api 的路由注册和输入校验。
- **api 不在请求中做慢操作**：发邮件、通知等一律投递到队列，由 worker 处理。
- **web 不直接访问数据库或 Redis**：只通过 `/api`。

## 2. 各层职责与代码位置

| 层 | 位置 | 负责 | 不负责 |
|---|---|---|---|
| 契约 | `contracts/src/**` | 请求/响应/队列负载的 zod schema；路由定义（`defineRoute`） | 任何实现 |
| HTTP 管道 | `apps/api/src/http-app.ts`、`src/http/**` | 请求 id 与访问日志、Better Auth 挂载、JSON 解析、全局校验管道、RFC 9457 错误格式 | 业务规则 |
| 鉴权 | `apps/api/src/auth/**` | Better Auth 配置、`SessionGuard`、`@CurrentActor()` | 权限以外的业务判断 |
| 控制器 | `apps/api/src/modules/<域>/*.controller.ts` | 用 `@ContractRoute` 等装饰器绑定契约，把请求映射到服务 | 业务逻辑、数据库访问 |
| 服务 | `modules/<域>/service.ts` | 业务规则；不依赖 Nest，所有副作用通过参数注入 | SQL、HTTP 细节 |
| 仓储 | `modules/<域>/repo.ts` | 唯一访问本域数据表的代码；每条查询按 `userId` 限定 | 业务规则 |
| 模块装配 | `modules/<域>/*.module.ts`、`app.module.ts` | 用注入令牌（`src/tokens.ts`）把服务、仓储、基础设施接起来 | 逻辑 |
| 队列生产者 | `apps/api/src/queue/**` | 按契约校验并投递任务 | 发送 |
| worker | `apps/worker/src/jobs/**`（纯函数）、`processors.ts`（Nest 装配） | 处理任务；最终失败写入死信队列 | HTTP 接口（只有 /healthz） |
| 数据库 | `packages/db` | Drizzle schema、迁移、演示数据、测试用容器 | 业务查询（在各域的仓储中） |
| 可观测性 | `packages/telemetry`、各应用的 `src/instrument.ts`、`apps/web/src/instrumentation*.ts` | OpenTelemetry 启动、队列积压指标、Sentry 错误上报；全部由环境变量开启 | 业务指标以外的业务逻辑 |
| 前端 | `apps/web/src/app/**`（路由）、`features/**`（功能）、`components/**`（通用组件） | 页面、表单校验、乐观更新 | 鉴权的最终判断（由 api 做） |

**为什么服务是纯函数工厂，而不是 `@Injectable()` 类？** 业务逻辑不依赖框架，单元测试不需要启动 Nest；Nest 只出现在“边缘”（控制器、守卫、模块）。依赖统一用 `@Inject(TOKEN)` 注入，因此构建链路（tsx、Vitest、TS 7）不需要 `emitDecoratorMetadata`。

## 3. 一个请求的完整路径（以“完成待办”为例）

1. 浏览器 `PATCH /api/todos/:id`，body `{ "completed": true }`。
2. web 的 `/api/*` 重写（部署时是 Caddy）把请求转给 api。
3. `requestContext` 分配请求 id（响应头 `x-request-id`），绑定子日志器。
4. `SessionGuard` 用 Cookie 向 Better Auth 查询会话；没有会话返回 401。
5. `@ContractParams` / `@ContractBody` 按 `updateTodoRoute` 的 schema 校验；失败返回 400 和逐字段错误。
6. `TodosController.update` 调用 `service.update(actor, id, patch)`。
7. 服务通过仓储读取、更新；待办首次变为已完成时调用 `notifyCompleted`，投递 `todo-completed` 任务。
8. 响应 200；访问日志记一行（方法、路径、状态、耗时、userId）。开启链路追踪时，以上每一步（含 SQL 和入队）都是同一条 trace 中的 span，日志也带同一个 `traceId`。
9. worker 的 `NotificationsProcessor` 取到任务（trace 上下文随任务一起传递，worker 的处理过程接在同一条 trace 下），渲染邮件，经 SMTP 发出；失败按退避重试，最终失败进入 `dead-letter` 队列并上报错误。

## 4. 新增一个接口的步骤

1. **契约**：在 `contracts/src/<域>/` 用 `defineRoute` 声明路由和 schema，加入 `apiRoutes`，运行 `pnpm gen`。
2. **服务**：在 `service.ts` 中实现业务逻辑，错误用 `ProblemError` 抛出；先写单元测试。
3. **仓储**（如需）：在 `repo.ts` 中添加查询，所有查询按 `userId` 过滤。
4. **控制器**：用 `@ContractRoute(route)` 和 `@ContractBody/Query/Params/Headers(route)` 绑定，无需手写路径与校验。
5. **集成测试**：在 `app.int.test.ts` 中经真实 HTTP、真实数据库验证。
6. **前端**：`packages/api-client` 已自动带上新类型，在 `features/<域>/` 中用 TanStack Query 调用。
7. 运行 `pnpm check`（包含 `contracts:check`：删除或改名字段会被判为破坏性变更）。

## 5. 测试：写在哪里、测什么

| 层级 | 文件 | 运行 | 适合测 | 不适合测 |
|---|---|---|---|---|
| 单元 | 与源码同目录的 `*.test.ts(x)` | `pnpm test`；覆盖率 `pnpm test:coverage` | 服务的业务规则、纯函数、schema、HTTP 管道（Nest 测试模块 + 假依赖）、React 组件（jsdom，只替换 `api` 客户端） | 真实数据库行为 |
| 集成 | `*.int.test.ts` | `pnpm test:int`（需要 Docker） | 迁移、SQL、鉴权全流程、幂等、分页边界 | 浏览器交互 |
| 端到端 | `tests/e2e/specs` | `pnpm e2e` | 核心用户路径：注册 → 验证邮件 → 操作 → 通知邮件 | 边界条件（放到单元/集成） |
| 压测 | `tests/load` | `pnpm test:load` | 热点接口的延迟与错误率基线 | 功能正确性 |
| AI 评测 | `evals/` | `pnpm eval`（需要 API 密钥，会产生费用） | 提示词或模型变更是否退化 | 确定性逻辑 |

写测试时的约定：

- 命名 `should <行为> when <条件>`；一个测试只验证一件事。
- 只 mock 系统边界（队列投递、SMTP、时间、AI 模型）。服务测试用内存仓储（见 `service.test.ts`），不 mock 服务自身。
- 修 bug 先写一个能复现的失败测试。
- 每个测试文件开头的中英注释块说明：测什么、哪些是真实的、哪些被替换、需要什么前置条件。
- 组件测试在文件第一行写 `// @vitest-environment jsdom`，用 `src/test/render.tsx` 的 `renderWithQuery` 渲染；网络只通过 `vi.mock("@/lib/api")` 替换，hooks 与 React Query 保持真实。
- 覆盖率只统计单元测试（入口文件、生成代码除外），报告在 `coverage/index.html`；模块装配、仓储和页面由集成测试与 e2e 覆盖。

CI 中的对应关系（工作流说明见 README “CI/CD”）：单元测试、覆盖率、契约检查在 `check` job；集成测试在 `integration` job；PR 只跑 e2e 冒烟，main 用生产镜像跑全量。CI 失败时，先在本地用同一条命令复现：覆盖率报告、Playwright 的 trace 与截图都作为 artifact 上传在对应运行的 Summary 页面，下载后用 `pnpm --filter @qic/e2e exec playwright show-trace <trace.zip>` 查看。

## 6. 调试手册

### 6.1 按请求 id 或 trace 追踪

每个 `/api` 响应都带 `x-request-id`。错误响应体中的 `traceId`：开启链路追踪时是 OpenTelemetry 的 trace id，否则就是请求 id。日志的每一行都带 `requestId`，在被追踪的请求或任务中还带 `traceId`/`spanId`，用它们搜索即可找到访问日志和错误堆栈。开发环境日志是可读格式；设置 `LOG_LEVEL=debug` 可看到 Nest 启动时的路由映射。

### 6.2 本地观测环境（Grafana）

1. 启动观测栈：`docker compose --profile obs up -d`（grafana/otel-lgtm，镜像约 900 MB）。
2. 在 `.env` 中设置 `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:14318`；想看到浏览器端的 span，再加 `NEXT_PUBLIC_OTEL_BROWSER=true`。然后 `pnpm dev`，api 与 worker 启动日志中会出现 `telemetry enabled`。
3. 打开 Grafana（http://localhost:13001）→ Explore：
   - **Tempo**：`{ resource.service.name = "api" }`。页面上的一次操作是一条完整的 trace：`web-browser` → api（含 Better Auth、SQL）→ 入队 → worker。在 span 上点 **Logs for this span** 跳到对应日志。
   - **Loki**：`{service_name="api"}`；日志中的 `trace_id` 可以跳回 trace。
   - **Prometheus**：`http_server_request_duration_seconds`（请求速率、错误、耗时）、`nodejs_eventloop_delay_p99_seconds`、`db_client_connection_count`、`qic_queue_jobs`、`bullmq_*`、`gen_ai_client_token_usage`、`qic_gen_ai_failures_total`。
   - **Alerting**：文件夹 QiC 中的 SLO 告警，每条都链接 [docs/runbooks](runbooks/README.md) 中的排查手册。
4. 未设置这些变量时什么都不会导出，也没有额外开销。

各开关一览（均为可选）：

| 变量 | 作用 |
|---|---|
| `OTEL_EXPORTER_OTLP_ENDPOINT`（及其他 `OTEL_EXPORTER_OTLP_*`） | api、worker、web 通过 OTLP/HTTP 导出 trace、指标和日志 |
| `SENTRY_DSN` | api、worker、web 服务端上报错误（5xx、最终失败的任务），带 release（`GIT_SHA`） |
| `NEXT_PUBLIC_SENTRY_DSN`、`NEXT_PUBLIC_OTEL_BROWSER` | 浏览器端错误上报与链路追踪；构建时写入 |
| `SENTRY_AUTH_TOKEN`、`SENTRY_ORG`、`SENTRY_PROJECT` | web 构建时上传 source map |
| `LANGFUSE_PUBLIC_KEY`、`LANGFUSE_SECRET_KEY`、`LANGFUSE_BASE_URL` | 把 GenAI span 额外发送到 Langfuse |
| `AI_PRICE_INPUT_USD_PER_MTOK`、`AI_PRICE_OUTPUT_USD_PER_MTOK` | 记录 LLM 成本指标 |
| `AI_TRACE_CONTENT` | 在 span 上记录提示词和输出（可能含用户数据，仅限本地） |

**为什么 api 和 worker 要用 `--import ./src/instrument.ts` 启动？** 应用是 ESM，OpenTelemetry 必须在 `pg`、`ioredis`、`express` 等包被导入之前挂好模块钩子，所以插桩入口要在 `main.ts` 之前预加载。`pnpm dev`、`start` 脚本、Dockerfile 和 `.vscode/launch.json` 都已包含这个参数；自己写启动命令时不要漏掉。

### 6.3 常见症状

| 症状 | 优先检查 |
|---|---|
| 登录/注册返回 403 或 “Invalid origin” | `PUBLIC_WEB_URL` 是否与浏览器地址一致；经 turbo 启动时变量是否在 `turbo.json` 的 `globalPassThroughEnv` 中 |
| 收不到验证邮件 | Mailpit（http://localhost:18025）；worker 是否在运行（日志中有 `worker started`）；`SMTP_URL` 是否用了 `127.0.0.1` 而非 `localhost`（nodemailer 不读 hosts 文件，某些 DNS 下会卡住） |
| 任务卡住或失败 | 开发环境打开 Bull Board（http://localhost:14000/admin/queues）查看每个任务的负载、失败原因并重试；最终失败的任务在 `dead-letter` 队列，保留原始负载。详见 [queue-backlog.md](runbooks/queue-backlog.md) |
| 401 但确认已登录 | 请求是否同源（经 web 的 `/api`）；Cookie `better-auth.session_token` 是否存在 |
| 400 “Request validation failed” | 响应体 `errors[].path` 指出字段；对照 `contracts/` 中的 schema |
| 请求返回 429 | 触发了限流：鉴权路由按“IP + 路径”（登录/注册每 10 秒 3 次），`@RateLimit` 路由按策略；响应头 `Retry-After` 为需等待的秒数。本地调试可设 `RATE_LIMIT_ENABLED=false`；计数键在 Redis 的 `rl:*` |
| `/readyz` 返回 503 | 响应体的 `checks` 指出哪个依赖不可达 |
| 端口冲突 | 开发依赖使用 1xxxx 段（见 README）；如仍冲突，用 `.env` 覆盖 |

### 6.4 各层的调试入口

- **数据库**：`docker compose exec postgres psql -U qic`（或任意客户端连 `localhost:15432`）；schema 变更流程见 [database-migrations.md](runbooks/database-migrations.md)。
- **断点调试**：VS Code 的 Run and Debug 中有 `api: launch`、`worker: launch`（直接在调试器中启动）、`api + worker`（同时启动），以及 `api: attach`、`worker: attach`（连接到 `pnpm --filter @qic/api dev:inspect` 启动的进程，端口 9229/9230）。`vitest: current file` 调试当前打开的测试文件。
- **单个测试**：`pnpm --filter @qic/api exec vitest run src/modules/todos/service.test.ts -t "idempotent"`。
- **端到端失败**：trace 和截图在 `tests/e2e/test-results/`，用 `pnpm --filter @qic/e2e exec playwright show-trace <trace.zip>` 回放。
- **容器与部署**：见 [infra/compose/README.md](../infra/compose/README.md) 的本地演练；容器日志 `docker compose -f docker-compose.prod.yml logs api`。
- **集成测试拉不到镜像**：设置 `TESTCONTAINERS_RYUK_DISABLED=true` 后重试。

## 7. 容易踩的坑

- **新增注入依赖时必须用 `@Inject(TOKEN)`**：构建链路不生成装饰器元数据，按类型自动注入会得到 `undefined`。
- **修改 `.pnpmfile.cjs` 后要运行 `pnpm install`**：lockfile 记录了它的校验和，否则镜像构建时 `--frozen-lockfile` 失败。
- **`shadcn add` 生成的组件**：导入路径要改为 `@qic/ui/lib/utils`，并补回中英文 TSDoc。
- **生成文件不要手改**：`openapi.json`、`*.gen.ts`、迁移快照都由命令生成。
- **自己写 Node 启动命令时别漏掉 `--import ./src/instrument.ts`**：漏掉不会报错，只是没有任何 trace。新增需要插桩的 ESM 依赖时，也要把包名加入 `packages/telemetry` 的 `HOOKED_MODULES`。
- **新建 BullMQ 队列要带 `telemetry`**：用 `apps/api/src/queue/options.ts` 的 `queueBaseOptions`，否则 worker 的 trace 与发起请求断开。
