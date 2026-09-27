# Runbook：接口变慢

**告警**：`api p95 latency above 500 ms`、`Event loop p99 delay above 200 ms`。
**SLO**：api 请求的 p95 延迟低于 500 ms。

## 1. 先分清是“一个接口慢”还是“整个进程慢”

```promql
# 各路由的 p95 延迟
histogram_quantile(0.95, sum by (le, http_route) (rate(http_server_request_duration_seconds_bucket{service_name="api"}[5m])))

# 事件循环延迟：升高说明进程被同步计算阻塞，所有请求都会被拖慢
max by (service_name) (nodejs_eventloop_delay_p99_seconds)
```

- **个别路由慢，事件循环正常**：请求在等待 I/O（数据库、Redis、外部 API），看第 2 步。
- **所有路由都慢，事件循环延迟高**：有同步的重计算（大 JSON 序列化、正则回溯、同步加密等）或 GC 压力，看第 3 步。

## 2. 找到慢在哪一步（I/O 等待）

在 Tempo 中搜索慢请求：`{ resource.service.name = "api" && duration > 500ms }`，打开 trace 看哪个子 span 最长：

| 最长的 span | 排查方向 |
|---|---|
| `pg.query:*` | 慢查询。把 span 中的 SQL 拿到 `psql` 执行 `EXPLAIN ANALYZE`；检查是否缺索引，加索引按 [database-migrations.md](database-migrations.md) 的安全写法 |
| 在 `pg.query` 之前有长时间空白 | 连接池耗尽：`db_client_connection_pending_requests` 持续大于 0。找出占用连接的长事务，或调整连接池大小 |
| `evalsha` / Redis 命令 | Redis 过载或网络问题；检查 Redis 内存与慢日志：`redis-cli SLOWLOG GET 10` |
| AI 调用（`ai.generateText` 等） | 模型响应慢属于预期范围（有 30 秒超时）；确认前端对这类接口有加载状态，必要时改为队列异步处理 |

## 3. 进程本身被阻塞

- `v8js_gc_duration_seconds` 升高且 `v8js_memory_heap_used_bytes` 持续增长：可能是内存泄漏，转到 [memory-leak.md](memory-leak.md)。
- 否则在本地复现后做 CPU profile：用 VS Code 的 “api: launch” 配置启动（见 `.vscode/launch.json`），或 `node --cpu-prof --import ./dist/instrument.js dist/main.js`，在 Chrome DevTools 中打开生成的 `.cpuprofile`，找到占用最多的同步函数。

## 4. 临时缓解

- 流量突增：确认限流已开启（`RATE_LIMIT_ENABLED`），必要时对热点接口加 `@RateLimit`。
- 单机资源不足：先扩容，再修复根因。
