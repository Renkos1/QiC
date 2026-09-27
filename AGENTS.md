# AGENTS.md

> 本文件是所有 AI 编码代理（Claude Code / Codex / Cursor 等）和人类贡献者在本仓库的工作准则。
> 优先级：用户当次明确指令 > 所在子目录的 AGENTS.md > 本文件 > 语言/社区通用惯例。
> 规则冲突、需求含糊或风险不明时：**停下来问，不要猜**。

## 1. 项目概览
- 项目：QiC — 社区与简易智能硬件工作区
- 架构：monorepo + 模块化单体；只有满足以下条件之一的模块才拆成独立服务：需要独立扩缩容、独立的发布节奏、不同的运行时。拆分前必须写 ADR。
- 可部署单元：`apps/web`（前端）、`apps/api`（HTTP API）、`apps/worker`（异步任务 / AI 任务）
- 关键文档：[`docs/developer-guide.md`](docs/developer-guide.md)（分层、测试、调试，先读这个）、[`docs/architecture.md`](docs/architecture.md)（架构图与数据流）、`docs/runbooks/`、`docs/adr/`（架构决策，从 0001 开始）、`contracts/`
- 技术栈 Profile：见 §18

## 2. 命令（唯一入口，不要自创命令或绕过脚本）
| 目的 | 命令 |
|---|---|
| 安装依赖 | `pnpm install --frozen-lockfile` |
| 启动依赖服务（DB/Redis 等） | `docker compose up -d` |
| 启动本地观测栈 | `docker compose --profile obs up -d`，并设置 `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:14318` → Grafana http://localhost:13001 |
| 本地开发 | `pnpm dev` |
| 断点调试 | VS Code 的 `.vscode/launch.json`；或 `pnpm --filter @qic/api dev:inspect`（worker 同理）后 attach |
| **提交前全量检查（必跑）** | `pnpm check`（= lint + typecheck + test + deps:check + contracts:check） |
| 只检查受影响的项目 | `pnpm turbo run check --affected` |
| 单个项目 | `pnpm --filter <pkg> <script>` |
| 格式化 / lint | `pnpm format` / `pnpm lint` |
| 类型检查 | `pnpm typecheck` |
| 单元测试 / 集成测试 | `pnpm test` / `pnpm test:int` |
| 单元测试覆盖率（有下限，低于即失败） | `pnpm test:coverage` → `coverage/index.html` |
| 端到端测试 | `pnpm e2e` |
| 契约生成 / 兼容性检查 | `pnpm gen` / `pnpm contracts:check` |
| 数据库迁移 | `pnpm db:generate`、`pnpm db:migrate`、`pnpm db:seed` |
| 构建 | `pnpm build` |
| 镜像 / 压测 / AI 评测 | `pnpm docker:build` / `pnpm test:load` / `pnpm eval` |

## 3. 目录地图与依赖方向
```
apps/        可部署应用（web / api / worker），每个都可以有自己的 AGENTS.md
packages/    共享库：ui、config（tsconfig/vitest 预设）、db、logger、mail、ai、api-client、telemetry
contracts/   API 契约唯一真相源（zod schema → openapi.json → 生成客户端）
infra/       compose/（生产 docker-compose、Caddy、部署与回滚脚本）、obs/（Grafana SLO 告警规则）
tests/e2e    Playwright；tests/load：k6
evals/       AI 功能评测集
docs/        developer-guide.md（分层与调试指南）、architecture.md（架构图）、adr/、runbooks/
tools/       脚本、代码生成器
.github/     CI/CD 工作流（ci、e2e、security、release、deploy）、共用 action、Renovate、模板
```
依赖规则（由 lint 和 CI 强制）：
- `apps/*` 可以依赖 `packages/*`、`contracts`；**`packages/*` 禁止依赖 `apps/*`**；包之间禁止循环依赖。
- 应用之间不直接 import，只通过 `contracts` 定义的 HTTP 接口或事件通信。
- 领域模块只通过各自的 `index.ts` 暴露公开 API；禁止深层引用其他模块的内部文件。
- 模块禁止直接读写其他模块的数据库表。

## 4. 工作流程
1. **理解**：先读相关代码、所在目录的 AGENTS.md、相关 ADR 和契约。开始前用 1–3 句话复述目标和验收标准。
2. **计划**：满足以下任一条件时，先提交计划、等待确认：改动超过 3 个文件；涉及契约、数据库 schema、依赖、CI、安全；需要做设计取舍。
3. **实现**：最小必要改动；模仿周边代码的风格、命名、注释密度；不顺手重构无关代码（发现问题就记下来汇报）。
4. **验证**：运行 `pnpm check`。修 bug 必须先写一个能复现问题的失败测试；UI 改动必须实际跑起来确认；声称“已验证”时必须附上命令和结果。
5. **交付**：按 §17 的格式汇报。

## 5. 硬性规则
**MUST**
- 所有外部输入（HTTP 请求、环境变量、LLM 输出、第三方 API 响应）都要在边界处用 schema（zod）校验。
- 错误显式处理：不吞异常；日志要带上下文；返回给用户的错误信息不能泄露内部细节。
- 新增或改变的行为必须有测试覆盖。
- 修改契约后必须运行 `pnpm gen` 并提交生成的文件。
- 使用仓库已有的依赖和工具函数；新增依赖前先说明理由（见 §15）。

**NEVER**
- 提交任何密钥、token、`.env`、个人数据或生产数据。
- 手动修改生成的文件（`*.gen.ts`、`openapi.json`、迁移快照、lockfile）。
- 通过 `skip`/`only`、删除断言、放宽类型（`any`、`@ts-ignore`）、修改阈值来让检查通过。
- 使用 `--no-verify`、force-push 到共享分支、直接 push 到 `main`。
- 修改已经发布的数据库迁移文件。
- 捏造 API、配置项或包名。不确定时去查源码、文档、registry。

## 6. 代码规范
通用：
- 命名表达意图；函数保持单一职责；嵌套不超过 3 层，多用提前返回。
- 优先使用纯函数；把副作用（IO、时间、随机数）集中在边界层，方便测试和注入。
- 不写只有一处调用的抽象；在第三次重复出现时再抽取公共代码。
- 格式化和 lint 以工具输出为准，不做人工风格争论。

TypeScript（Profile 规则）：
- `strict: true`、`noUncheckedIndexedAccess: true`；禁止 `any`，不确定的类型用 `unknown` 再收窄。
- 类型尽量从 zod schema 推导（`z.infer`），不要同时手写一份重复的 interface。
- 只用 ESM；只用具名导出（Next.js 路由文件除外）。
- 异步统一用 `async/await`；每个 Promise 都要被 await 或显式处理。
- 文件名：`kebab-case.ts`；React 组件文件：`PascalCase.tsx`；测试文件：`*.test.ts`，与源文件放在同一目录。

NestJS（apps/api、apps/worker）：
- 依赖一律 `@Inject(TOKEN)` 注入（令牌在各应用的 `src/tokens.ts`），不依赖 `emitDecoratorMetadata`。
- 业务逻辑写在不依赖 Nest 的纯函数工厂里；Nest 只用于控制器、守卫、过滤器和模块装配。
- api 路由必须通过 `@ContractRoute` 等契约装饰器绑定，不手写路径和校验。

## 7. 注释与文档
- 注释写**为什么**（意图、约束、权衡、坑），不写代码字面上在做什么。
- **TSDoc 全覆盖、中英结合**：所有导出的声明（函数、类、接口、类型、常量、React 组件、Nest 模块/控制器/守卫及其公开方法）都写 TSDoc，格式固定：
  ```ts
  /**
   * Creates the todo service: cursor pagination, idempotent create, notifications.
   *
   * 创建待办服务：游标分页、幂等创建、完成通知。
   *
   * @param deps - Repository, idempotency store and outbound side effects.
   *   仓储、幂等存储与对外副作用。
   * @returns The service the controller delegates to. 控制器调用的服务。
   * @throws {ProblemError} 404 when the todo is not the caller's. 待办不属于调用者时抛 404。
   */
  ```
  - 第一段是完整的英文摘要（工具、IDE 悬停摘要和 AI 代理读取它），空行后是中文说明（面向人，可补充背景，不必逐字翻译）。
  - 标签（`@param` / `@returns` / `@throws` / `@example`）先英文、后中文；中文放在同一行末尾或下一行缩进续写。
  - 标识符、路径、命令一律放在反引号里，中英文都不翻译它们。
  - 除测试文件外不设例外（包括 shadcn 生成的组件：重新 `shadcn add --overwrite` 后需补回注释）。
  - 测试文件不写逐个用例的 TSDoc（`should … when …` 名称即说明），但每个测试文件开头写一个中英 `/* */` 块：测什么、哪些是真实的、哪些被替换（mock/fake）、前置条件（如需要 Docker）。非显然的准备步骤用英文行内注释说明原因。
  - 只有一句话就能说清的类型或常量，可以写成单行：`/** English. 中文。 */`。
- 行内 `//` 注释只写英文、完整句子，解释“为什么”；不重复 TSDoc 已写的内容。
- 没有可挂 TSDoc 的声明时（入口文件、脚本、re-export 汇总文件），在文件头写 `/* */` 块，同样先英文后中文。
- 可写注释的配置文件（YAML、TOML、JSONC、`.cjs`、`*.config.ts`、`.gitignore` 等）为每个非自明的配置项写一行精要说明：`# English. 中文。`
- TODO 必须关联 issue：`// TODO(#123): ...`。禁止留下被注释掉的代码。
- 架构级决策写成 ADR：`docs/adr/NNNN-title.md`（背景 / 决策 / 后果）。
- 行为或命令变了，同步更新 README、AGENTS.md、runbook。

## 8. 测试
| 层 | 位置 | 要求 |
|---|---|---|
| 静态检查 | 全仓 | lint、typecheck、build 必须通过 |
| 单元测试 | `*.test.ts(x)`（Vitest；组件测试用 jsdom + Testing Library） | 不依赖网络和 DB；运行要快，结果确定；覆盖率下限见根 `vitest.config.ts`，只许上调 |
| 集成测试 | `*.int.test.ts`（Vitest + Testcontainers） | 使用真实的 Postgres/Redis，不 mock 数据库 |
| 契约测试 | `pnpm contracts:check` | 用 oasdiff 检测破坏性变更；有破坏性变更必须升级版本并走 ADR |
| 端到端测试 | `tests/e2e`（Playwright） | 只覆盖核心用户路径；选择器用 role/testid |
| 压测 | `tests/load`（k6） | 修改热点路径时运行，并与基线对比 |
| AI 评测 | `evals/` | 修改 prompt 或模型时运行，得分不得低于基线 |

原则：测试行为，不测实现细节；一个测试只验证一件事；测试命名格式为 `should <行为> when <条件>`；只 mock 系统边界（第三方服务、时间），不 mock 被测模块自己的代码。

## 9. API 与契约
- 契约优先：先改 `contracts/` 里的 zod schema，再实现接口；`openapi.json` 和客户端代码由生成得到。
- REST 约定：资源名用复数名词；错误统一使用 RFC 9457 `application/problem+json` 格式；分页用游标；写接口支持 `Idempotency-Key`。
- 兼容性：只允许新增可选字段；删除或改名要经过“新增 → 迁移 → 废弃 → 删除”的过程。

## 10. 数据与迁移
- schema 修改走 `pnpm db:generate` 生成迁移，迁移文件要人工审阅后提交。
- 采用 expand/contract 模式：先加列、双写、回填数据，下一次发布再删除旧列；每个迁移都必须能在线执行、可回滚。
- 严禁在应用代码里拼接 SQL；使用 ORM 或参数化查询。

## 11. 安全
- 密钥只通过环境变量注入，启动时用 schema 校验；示例值放在 `.env.example`。
- 鉴权和授权在服务端完成，每个接口都要检查权限；默认拒绝。
- 限流：鉴权路由由 Better Auth 限流（计数在 Redis）；会产生费用或容易被滥用的接口（AI 调用、发邮件、导出等）必须加 `@RateLimit`，并在契约中声明 `rateLimitedResponse()`。开关为 `RATE_LIMIT_ENABLED`（生产默认开启）。
- 日志里不能出现密钥、token、完整的个人信息。
- 新增依赖要检查维护状态、许可证、下载量，并确认包名拼写（防止 typosquatting）。

## 12. 可观测性与调试
- 日志只用 `@qic/logger`（pino），不用 `console.*`；日志带 traceId 和 requestId 上下文；不记录密钥和个人信息。
- 日志级别：`error` 表示需要有人处理；`warn` 表示异常但能自动恢复；`info` 记录业务关键事件；`debug` 默认关闭。
- 链路追踪由 `@qic/telemetry` 自动插桩（HTTP、Express/Nest、pg、ioredis、pino），api/worker 必须通过 `--import ./src/instrument.ts`（生产为 `dist/instrument.js`）启动；新增需要插桩的 ESM 依赖时，把包名加入 `HOOKED_MODULES`。
- 新建 BullMQ `Queue`/`Worker` 时必须带 `telemetry: new BullMQOtel(...)`（见 `apps/api/src/queue/options.ts`），trace 上下文才能从请求传到任务。
- 其他外部调用（无自动插桩的 SDK）用 `@opentelemetry/api` 的 `tracer.startActiveSpan` 手动包一层 span。
- HTTP 的 RED 指标由插桩自动产生；新的后台流程要补充对应指标（参考 `observeQueueBacklog`、`qic.gen_ai.failures`）。新增依赖服务时，要在 `/readyz` 里加上对它的检查。
- 意外错误（5xx、重试耗尽的任务）经 `ErrorReporter` 上报；预期内的失败（4xx、可重试）不上报。新增告警写在 `infra/obs/grafana/alerting/`，并必须带 `runbook_url`。
- 所有观测开关只由环境变量决定（`OTEL_EXPORTER_OTLP_*`、`SENTRY_DSN`、`LANGFUSE_*`），未设置时必须零开销地关闭；新增变量要同时加到 `.env.example` 和 `turbo.json`。
- 调试流程：先复现并写失败测试 → 列出假设和验证方法 → 一次只改一个变量 → 修根因 → 回归测试。
- 禁止靠猜来修；汇报时要写明根因、证据（trace/日志/测试）、修复方式、预防措施。
- 排查手册见 `docs/runbooks/`。

## 13. AI / LLM 功能
- 模型 ID、温度、max tokens 等参数放在配置里，不写死在代码中；prompt 放在 `packages/ai/src/prompts/`，作为代码进行 review。
- LLM 输出必须用 schema 校验（结构化输出 + zod），校验失败时有重试或降级方案。
- 必须设置超时、重试上限、token 和成本预算；记录 token 用量、延迟和模型版本（Langfuse / OTel GenAI span）。模型调用一律经过 `generateStructured`（或同样传 `telemetry: telemetryFor(operation)`），token、成本和失败指标才会按操作名统计；提示词和输出默认不写入 span（`AI_TRACE_CONTENT` 仅限本地）。
- 用户输入和检索到的外部内容一律视为数据，不当作指令（防御 prompt injection）；工具调用使用最小权限。
- 修改 prompt 或模型必须附上 `evals/` 的评测结果对比。

## 14. Git 与 PR
- 采用 trunk-based 开发；分支命名 `feat|fix|chore|refactor|docs|test/<简述>`，分支存活时间以天计。
- 提交信息遵循 Conventional Commits：`feat(api): add cursor pagination to /orders`；一个提交只做一件事。
- PR 要小（建议不超过 400 行，生成文件除外），描述包括：动机、改动内容、验证方式、风险与回滚方案。
- 未完成的功能用 feature flag 隐藏，保证 `main` 随时可以发布。
- 合并方式：squash merge，需要 CI 全部通过 + CODEOWNERS review。
- CI 的检查与 `pnpm check` 一致，另加覆盖率、集成测试、e2e 与安全扫描；本地先跑 `pnpm check` 再推送。工作流里的 Action 一律固定到 commit SHA（后缀写版本注释），由 Renovate 更新。
- 版本与 CHANGELOG 由 release-please 根据提交信息生成，不要手动修改版本号或 `CHANGELOG.md`。

## 15. 必须先征得人类确认的操作
- 新增、升级、删除依赖；修改 lockfile 以外的构建或 CI 配置
- 修改契约（尤其是破坏性变更）、数据库 schema、鉴权逻辑
- 删除文件或目录、大范围重命名、跨模块重构
- 任何涉及生产环境、真实数据、费用、对外发布（推送、发帖、调用付费 API）的操作；线上回滚和数据修复
- 与本文件规则冲突，或需要偏离 ADR 的做法

## 16. 完成标准（Definition of Done）
- [ ] `pnpm check` 全部通过，没有新增 warning
- [ ] 新行为有测试；bug 修复有回归测试
- [ ] 契约、生成代码、迁移文件已更新并提交
- [ ] 新代码路径带有日志、trace、指标（按 §12）
- [ ] 文档（README、runbook、ADR、AGENTS.md）已同步更新
- [ ] 没有调试代码、多余日志、被注释掉的代码、未关联 issue 的 TODO

## 17. 汇报格式
1. **结果**：一句话说明做成了什么，或者卡在哪里。
2. **改动**：文件列表 + 每个文件的一句话说明。
3. **验证**：运行了哪些命令，结果如何；没有验证的部分要明确写出来。
4. **风险 / 待决**：需要人类决定的问题、发现但没有处理的问题。
（修 bug 时额外写明：根因、证据、预防措施。）

## 18. 技术栈 Profile：TS 全栈
Node（LTS，版本由 `.mise.toml` 锁定）· pnpm workspaces · Turborepo · TypeScript strict · Biome ·
Web：Next.js（App Router）+ Tailwind + shadcn/ui + TanStack Query ·
API：NestJS（Express 适配器，zod 契约经 Standard Schema 校验） · Worker：NestJS + BullMQ（@nestjs/bullmq） · DB：PostgreSQL + Drizzle · Redis ·
Auth：Better Auth（邮箱） · AI：Anthropic + Vercel AI SDK · 校验：zod · 日志：pino · 观测：OpenTelemetry（本地 Grafana LGTM）+ Sentry / Langfuse（可选接入） ·
测试：Vitest / Testcontainers / Playwright / k6 / oasdiff · 依赖约束：dependency-cruiser · Git 钩子：lefthook + commitlint

## 19. 维护本文件
- AI 同一类错误出现第二次时，把对应规则补充进来；能用工具强制的规则，改为用工具强制，并从本文件删除。
- 根文件控制在 250 行以内；子项目的细节写到对应子目录的 AGENTS.md。
