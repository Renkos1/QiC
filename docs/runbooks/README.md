# Runbooks

线上问题的排查手册。每条 Grafana 告警（`infra/obs/grafana/alerting/qic-slo.yaml`）都通过 `runbook_url` 指向其中一份。

| 手册 | 对应告警 |
|---|---|
| [api-5xx.md](api-5xx.md) | api 5xx error budget burning fast |
| [slow-api.md](slow-api.md) | api p95 latency above 500 ms · Event loop p99 delay above 200 ms |
| [queue-backlog.md](queue-backlog.md) | Queue backlog not draining · Jobs in the dead-letter queue |
| [memory-leak.md](memory-leak.md) | Heap large and still growing |
| [llm-output.md](llm-output.md) | AI operations failing |
| [database-migrations.md](database-migrations.md) | —（变更流程，不是告警） |

通用入口：

- **本地观测环境**：`docker compose --profile obs up -d`，再以 `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:14318` 启动应用；Grafana 在 http://localhost:13001。
- **从一个错误找到全部上下文**：错误响应中的 `traceId`、Sentry 事件的 `traceId` 标签和每行日志的 `traceId` 是同一个值。在 Tempo 中打开 trace，可以跳到各服务的对应日志。
