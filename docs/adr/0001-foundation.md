# ADR 0001：工程基座的技术选型与定稿决策

- 状态：已采纳
- 日期：2026-09-27
- 范围：整个仓库（初始化阶段的全部决策）

## 背景

QiC 目前还没有产品定义。本仓库的目标是先搭好一个**可直接承载真实业务的工程基座**：本地一条命令就能运行，有契约、鉴权、数据、队列、AI、测试、部署和可观测性的完整链路，并且对人和 AI 协作者都容易理解。Todo 模块只用来演示这条链路。

本 ADR 记录初始化阶段做出的全部选型，以及相对最初计划的调整和原因。之后的变更各自新写 ADR，不修改本文。

## 决策

### 仓库与工具链

| 决策 | 结论 | 原因 |
|---|---|---|
| 仓库形态 | pnpm workspaces + Turborepo 单仓；npm scope `@qic` | 前后端共享契约与类型，一次改动一次评审 |
| 版本管理 | 共享依赖版本集中在 `pnpm-workspace.yaml` 的 catalog；工具版本由 mise 锁定（Node 24、pnpm、oasdiff、k6） | 版本只在一处修改；Windows 原生与 devcontainer 行为一致 |
| 依赖安全 | pnpm 默认禁止依赖的安装脚本（`allowBuilds` 逐个声明）；新发布版本需等待最短发布时长（例外写在 `minimumReleaseAgeExclude`） | 降低供应链风险 |
| `.pnpmfile.cjs` | 在解析前移除 better-auth 用不到的可选 peer | 否则 api 镜像会带上 web 的 Next 与 Playwright（188 MB → 约 74 MB） |
| TypeScript 双轨 | 类型检查与构建用 TS 7 原生编译器（`tsc-native`，`@qic/config` 提供）；需要 JS 编译器 API 的工具（如 openapi-typescript）仍用 TS 6 | 原生编译器快一个数量级；生态工具尚未全部支持 TS 7 |
| lint / 格式化 | Biome（`biome.jsonc`）；依赖方向由 dependency-cruiser 强制 | 单一工具、速度快；分层规则可自动检查 |
| 源码直连 | 工作区包通过自定义导出条件 `@qic/source` 指向 `src`（开发、测试、类型检查），构建产物给镜像使用 | 本地修改即时生效，无需先构建依赖包 |
| vite | 作为 catalog 依赖显式锁定 | Vitest 的 peer；显式锁定避免各包解析出不同版本 |

### 应用

| 决策 | 结论 | 原因 |
|---|---|---|
| 后端框架 | api、worker 使用 NestJS 12（Express 适配器）。**依赖一律 `@Inject(TOKEN)` 注入**，不使用 `emitDecoratorMetadata`；服务保持为不依赖 Nest 的纯函数工厂 | 统一的模块化与生命周期管理；构建链路（tsx、Vitest、TS 7）不生成装饰器元数据；业务逻辑可脱离框架单测 |
| 契约 | zod schema + `@asteasolutions/zod-to-openapi` 生成 `openapi.json`；前端用 openapi-typescript + openapi-fetch；api 用 `@ContractRoute` 等装饰器绑定同一份定义；oasdiff 拦截破坏性变更 | 契约是唯一真相源，前后端不会漂移；与框架无关 |
| 错误格式 | RFC 9457 problem+json；5xx 不泄露内部信息 | 标准格式，前端统一处理 |
| 鉴权 | Better Auth（第一版仅邮箱）挂在 api 的 `/api/auth/*`；web 经同源 `/api` 访问，Cookie 为第一方 | 成熟的会话与邮箱验证流程；同源避免跨站 Cookie 问题 |
| 限流 | Better Auth 与通用 `@RateLimit` 共用 Redis 固定窗口限流器（Lua 原子 INCR+EXPIRE）；`RATE_LIMIT_ENABLED` 在生产默认开启；客户端 IP 取 Caddy 覆写的单值 `X-Forwarded-For` | 多实例共享计数；客户端无法伪造 IP 绕过 |
| 队列 | BullMQ + ioredis；最终失败写入永不自动删除的死信队列 | BullMQ 只支持 ioredis；死信保留负载便于重放 |
| 邮件 | nodemailer；开发用 Mailpit，生产用 SMTP；发信一律经 worker | 请求路径中不做慢操作 |
| AI | Vercel AI SDK 7 + `@ai-sdk/anthropic`，默认模型 `claude-opus-5`（`AI_MODEL` 可覆盖）；结构化输出用 `generateText` + `Output.object`（AI SDK 7 的推荐写法，替代计划中的 `generateObject`）；无 API key 时功能降级而非报错 | 模型是配置；可选依赖不影响本地开发和 CI |
| 前端 | Next.js 16 App Router、Tailwind、shadcn/ui（`packages/ui`）、TanStack Query、react-hook-form + zod；字体自托管（geist、Outfit），不依赖外部 CDN | 离线可用、无第三方请求 |
| 前端的两个生产问题 | 登录和退出后用 `hardNavigate()` 整页跳转；表单提交按钮在水合前禁用（`useHydrated()`） | 前者避免 prefetch 缓存“未登录时的跳转”；后者防止水合前的原生 GET 提交把密码写进 URL |
| 日志 | pino，固定字段 service/env/release，请求内带 requestId，被追踪时带 traceId/spanId；`@qic/logger` 先于各应用建立 | 所有应用日志格式一致，可与 trace 互相跳转 |

### 测试

| 决策 | 结论 | 原因 |
|---|---|---|
| 分层 | 单元（Vitest，与源码同目录）、集成（Testcontainers，`*.int.test.ts`）、e2e（Playwright）、压测（k6）、AI 评测（`evals/`） | 测试放在被测代码旁边，重构时一起移动 |
| 前端测试 | jsdom + Testing Library；网络只在 `@/lib/api` 边界用 `vi.mock` 替换（计划中的 MSW 未采用） | 边界只有一个，模块替换比拦截网络更简单 |
| 覆盖率 | v8 覆盖率只统计单元测试，门槛略低于当前实际值，只能上调 | 防止覆盖率悄悄下降 |

### 部署

| 决策 | 结论 | 原因 |
|---|---|---|
| 形态 | 单机 docker compose + Caddy（自动 HTTPS）；按 digest 部署与回滚；不用 k8s/Terraform；第一版无 staging | 与当前规模匹配，运维成本最低 |
| 镜像 | 构建阶段用 Debian trixie（TS 7 原生编译器没有 musl 版本），运行阶段用 Alpine；非 root、只读文件系统、健康检查 | 构建可用、运行时体积小 |
| 脚本 | 部署与回滚脚本为 POSIX sh | 服务器上不需要额外运行时 |
| 迁移 | Drizzle；expand/contract，迁移由独立的 `migrate` 服务在应用前执行 | 新旧版本可同时运行，回滚只需切换镜像 |

### 可观测性

| 决策 | 结论 | 原因 |
|---|---|---|
| 启动方式 | `packages/telemetry` 用 sdk-node + 逐个指定的插桩（http、express、nestjs-core、pg、ioredis、pino、runtime-node），不用 auto-instrumentations；api/worker 以 `--import ./src/instrument.ts` 启动，通过 import-in-the-middle 的同步钩子只挂 `HOOKED_MODULES` | ESM 下插桩必须先于被插桩包加载；只挂需要的模块，风险和开销最小 |
| 开关 | 只由环境变量决定：`OTEL_EXPORTER_OTLP_*`、`SENTRY_DSN`、`LANGFUSE_*`；未设置时零开销 | 同一镜像适用于所有环境；本地与 CI 不依赖外部服务 |
| 队列链路 | 生产者与消费者都配置 `bullmq-otel`，trace 从请求延续到任务 | 一次操作的异步部分也在同一条 trace 中 |
| 错误 | Sentry 只做错误上报，不接管 OpenTelemetry；事件带 `traceId` 标签；默认不采集任何个人数据 | 追踪只有一套管道；错误可以跳转到 trace |
| web | 服务端用 @vercel/otel；浏览器追踪与错误上报是构建时开关（`NEXT_PUBLIC_*`），代码按需懒加载；浏览器 span 经同源 `/otlp/v1/traces` 中转 | 浏览器无法读取运行时变量；采集端不必暴露到公网 |
| LLM | 通过 AI SDK 7 的 Telemetry 集成产生 GenAI span、token 与成本指标，失败次数在 `generateStructured` 中统计；提示词与输出默认不写入 span | 所有模型调用统一计量；避免用户数据进入观测系统 |
| 本地环境 | `grafana/otel-lgtm`（obs profile）；SLO 告警规则在 `infra/obs/`，每条链接 `docs/runbooks/` 中的手册 | 一个容器即可体验完整的 trace/指标/日志/告警 |
| Bull Board | 仅开发环境挂载，且为 devDependency、动态导入 | 没有鉴权；生产镜像不包含它 |

### 协作约定

| 决策 | 结论 |
|---|---|
| 注释 | 全部导出声明写中英结合的 TSDoc（英文段落在前、中文在后）；行内注释用英文；入口、脚本、测试文件写中英文件头；可写注释的配置文件写中英精要注释 |
| 文档 | AGENTS.md 是命令与规则的唯一来源（CLAUDE.md 只引用它）；面向人的说明在 `docs/developer-guide.md` 与本目录 |
| 提交 | Conventional Commits；提交信息与 PR 描述不包含模型信息 |
| 端口 | 开发与测试的宿主机端口使用 1xxxx 段（web 13000、api 14000、Postgres 15432、Redis 16379 等），避免与本机其他服务冲突；容器内与生产保持标准端口 |
| 命名 | 项目名 QiC；镜像、数据库、compose 项目名统一为 `qic` |
| 开发容器 | `.devcontainer` 复用 docker-compose.yml 的依赖服务，工具版本仍由 mise 决定；Windows 原生与容器二选一，不共用同一个检出目录 |
| AI 工具权限 | `.claude/settings.json` 允许 lint/测试/构建与只读 git/pnpm 命令；禁止读取 `.env`、`.env.prod` 等密钥文件（`.env.example` 这类模板仍可读写，便于维护）、`git push --force`、`rm -rf` |

## 相对最初计划的调整

1. **后端框架**：最初使用 Hono，后改为 NestJS 12；契约改用框架无关的 zod-to-openapi，`openapi.json` 在迁移前后逐字节一致。
2. **端口**：从各服务的默认端口改为 1xxxx 段。
3. **Todo 的定位**：从“首个功能”改为“示例纵向切片”，路径为 `/examples/todos`，产品定义确定后由真实领域模块替代。
4. **结构化输出**：`generateObject` 改为 AI SDK 7 推荐的 `generateText` + `Output.object`。
5. **前端 mock**：未引入 MSW，只在 `@/lib/api` 边界使用 `vi.mock`。
6. **新增的约定**：限流、`hardNavigate` / `useHydrated`、中英注释规范、提交信息不含模型信息，均是在实现和演练中发现问题后补充的。

## 影响

- 新成员（人或 AI）只需阅读 README 与 AGENTS.md 即可运行项目；分层与调试见 `docs/developer-guide.md`，整体结构见 `docs/architecture.md`。
- NestJS 与 `@Inject(TOKEN)` 的组合要求新增依赖时显式声明令牌；这是有意为之的约束。
- 可观测性与错误上报的依赖使 api 镜像由约 74 MB 增至约 100 MB。
- 待办事项：Phase 8（CI/CD 与仓库治理）需要建好 GitHub 仓库后进行；runbook 链接在建仓后改为完整 URL；提供 `SENTRY_DSN` 后验证 source map 与 release。
