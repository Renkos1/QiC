# Runbook：api 返回 5xx

**告警**：`api 5xx error budget burning fast`（Grafana → Alerting，文件夹 QiC）。
**SLO**：99.5% 的 api 请求不返回 5xx。告警条件是 5 分钟和 1 小时两个窗口的 5xx 比例都超过错误预算的 14.4 倍（约 7.2%），按这个速度 30 天的预算两天内就会耗尽。

## 1. 确认范围（2 分钟内）

在 Grafana → Explore → Prometheus 中：

```promql
# 哪些路由在报错
sum by (http_route, http_response_status_code) (rate(http_server_request_duration_seconds_count{service_name="api", http_response_status_code=~"5.."}[5m]))
```

- **集中在一个路由**：多半是该模块的代码或它依赖的外部服务出了问题，继续第 2 步。
- **所有路由都在报错**：先看依赖是否可达：`curl https://<域名>/readyz` 的 `checks` 字段会指出数据库或 Redis 哪个不可用（Caddy 不对外转发 `/readyz` 时，在服务器上执行 `docker compose -f docker-compose.prod.yml exec api wget -qO- http://127.0.0.1:4000/readyz`）。
- **刚刚发布过**：直接回滚，再排查（见 [infra/compose/README.md](../../infra/compose/README.md) 的 `rollback.sh`）。回滚是否安全取决于迁移是否遵守 [expand/contract](database-migrations.md)。

## 2. 找到具体错误

- **Sentry**（已配置 `SENTRY_DSN` 时）：按 release 查看新出现的问题；事件标签里的 `traceId` 可以直接粘贴到 Tempo 中查看整条链路。
- **Tempo**（Grafana → Explore → Tempo）：`{ resource.service.name = "api" && status = error }`，打开一条 trace，从出错的 span 点 **Logs for this span** 跳到对应日志。
- **Loki**：`{service_name="api"} | detected_level="error"`，日志中的 `err.stack` 就是原始堆栈。
- 用户反馈的错误响应中有 `traceId`（未开启链路追踪时是请求 id），可以直接用它搜索 trace 或日志。

## 3. 常见原因

| 现象 | 可能原因 | 处理 |
|---|---|---|
| `ECONNREFUSED` / `Connection terminated` | 数据库或 Redis 重启、连接数耗尽 | 看 `db_client_connection_count` 与 `db_client_connection_pending_requests`；确认依赖恢复后错误是否自然消失 |
| 只在某个路由出现 `TypeError` | 新代码的缺陷 | 回滚，再修复并补测试 |
| 所有写接口失败、读接口正常 | 迁移未执行或与代码不兼容 | 检查部署日志中的迁移步骤；按 expand/contract 补救 |
| 5xx 伴随延迟升高 | 过载或慢查询 | 转到 [slow-api.md](slow-api.md) |

## 4. 收尾

- 在事后记录中写明触发原因、影响时长和受影响的路由。
- 为该缺陷补充能复现问题的测试（单元测试或 `pnpm test:int`）。
