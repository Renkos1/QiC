# Runbook：队列积压与死信

**告警**：`Queue backlog not draining`（某个队列等待中的任务超过 100 个并持续 10 分钟）、`Jobs in the dead-letter queue`（出现死信）。
**SLO**：入队的任务在 10 分钟内被处理。

## 1. 看积压在哪里

```promql
# 各队列、各状态的任务数（由 worker 每次采集时从 Redis 读取）
qic_queue_jobs
# 处理速度与失败
sum by (bullmq_queue_name) (rate(bullmq_jobs_completed_total[5m]))
sum by (bullmq_queue_name) (rate(bullmq_jobs_failed_total[5m]))
# 单个任务的处理耗时
histogram_quantile(0.95, sum by (le, bullmq_queue_name) (rate(bullmq_job_duration_milliseconds_bucket[5m])))
```

| 现象 | 含义 | 处理 |
|---|---|---|
| waiting 增长，completed 速率为 0 | worker 没有在消费 | 检查 worker 是否存活：`/healthz` 返回 503 表示消费者已停止；查看 worker 日志与重启记录 |
| waiting 增长，completed 速率正常但偏低 | 入队速度超过处理能力 | 提高 `WORKER_CONCURRENCY` 或增加 worker 副本；检查单个任务耗时是否异常 |
| failed 速率高 | 任务在重试 | 看第 2 步 |
| delayed 很多 | 大量任务在退避等待重试 | 通常是下游服务（如 SMTP）不可用，先恢复下游 |

## 2. 查看失败原因

- **开发环境**：打开 Bull Board（http://localhost:14000/admin/queues），可以看到每个任务的负载、失败原因和堆栈，并能手动重试。它没有鉴权，只在开发环境挂载。
- **生产环境**：worker 日志中搜索 `job failed`：`{service_name="worker"} |= "job failed"`。每条日志都带 `traceId`，可以跳到产生这个任务的原始请求。
- 最终失败（重试耗尽或不可恢复）的任务会写入死信队列 `dead-letter`，同时上报 Sentry。

## 3. 处理死信

死信保留了原始负载，永远不会被自动删除。

1. 按死信中的 `failedReason` 修复根因（配置错误、下游故障或代码缺陷）。
2. 确认修复后再重放：在 Bull Board 中重试，或写一个一次性脚本把 `data` 重新投递到原队列（`queue` 字段）。重放前确认重复执行的后果（例如邮件任务会再发一封邮件）。
3. 确认无需处理的死信，在记录原因后再删除。

## 4. 相关代码

- 重试策略：`contracts/src/jobs/`（每类任务的 `attempts` 与退避）。
- 死信逻辑：`apps/worker/src/dead-letter.ts`。
- 积压指标：`packages/telemetry/src/metrics.ts`。
