# apps/worker — AGENTS.md

> 只写与根目录 AGENTS.md 不同或更具体的内容。分层说明与调试手册见 [docs/developer-guide.md](../../docs/developer-guide.md)。

- **职责**：消费 BullMQ 队列（邮件、通知等后台任务）。除容器健康检查 `GET /healthz` 外没有 HTTP 接口。
- **入口**：`src/instrument.ts`（OpenTelemetry，经 `--import` 预加载）→ `src/main.ts`（启动消费者；停机时等待进行中的任务完成）。
- **结构**：任务处理逻辑是 `src/jobs/*.ts` 中的纯函数（不依赖 Nest，直接单测）；`src/processors.ts` 负责 Nest 装配（`@Processor` + `WorkerHost`），每个队列一个处理器类。
- **新增任务类型**：先在 `contracts/src/jobs/` 定义负载 schema、任务名和重试策略 → api 侧生产者（`apps/api/src/queue/`）→ 本应用的 `src/jobs/` 纯函数（先写测试）→ `processors.ts` 注册 → 在 `worker.module.ts` 的 `registerQueue` 与 `QueueMetrics` 中加入新队列。
- **幂等与重试**：任务可能被重复执行（重试、重放死信），处理器必须能安全地重复运行，或在负载中带幂等键。可恢复的错误直接抛出，由 BullMQ 按契约退避重试；不可恢复的错误抛 `UnrecoverableError`，直接进入死信。
- **死信**：最终失败的任务写入 `dead-letter` 队列（保留原始负载、永不自动删除）并上报错误；处理方法见 [docs/runbooks/queue-backlog.md](../../docs/runbooks/queue-backlog.md)。
- **依赖注入**：与 api 相同，一律 `@Inject(TOKEN)`（`src/tokens.ts`）。
- **可观测性**：`BullModule.forRoot` 带 `BullMQOtel`，每个任务都接在投递它的请求的 trace 下；日志自动带 `traceId`。队列积压指标由 `src/queue-metrics.ts` 发布。
- **测试**：`pnpm --filter @qic/worker test`。
- **本地端口**：健康检查 14100；e2e 14300；调试 `pnpm --filter @qic/worker dev:inspect` 监听 9230。
