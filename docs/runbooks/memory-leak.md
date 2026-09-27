# Runbook：内存泄漏

**告警**：`Heap large and still growing`（某个服务的 V8 堆超过 300 MB，且 30 分钟内持续增长）。
阈值只是起点，应按容器的内存上限调整。

## 1. 确认是泄漏而不是正常负载

```promql
sum by (service_name) (v8js_memory_heap_used_bytes)
rate(v8js_gc_duration_seconds_sum[5m])
```

- **泄漏**：每次 GC 后的低点也在逐步抬高（锯齿形整体上移），与流量无关。
- **正常负载**：堆随流量升降，流量下降后能回落。
- 容器被 OOM 杀掉会表现为进程重启：`docker compose -f docker-compose.prod.yml ps` 查看重启次数，`docker inspect <容器> --format '{{.State.OOMKilled}}'` 确认。

## 2. 临时缓解

重启受影响的服务可以立即释放内存（`docker compose -f docker-compose.prod.yml restart api`）。重启只是争取时间，还要继续定位根因。

## 3. 定位

1. **与发布对照**：增长是否从某次发布开始？对比该版本的改动，优先怀疑模块级的缓存、`Map`/数组、事件监听器和定时器。
2. **本地复现并抓堆快照**：
   - 用 VS Code 的 “api: launch” 或 “worker: launch” 配置启动（见 `.vscode/launch.json`），或 `node --inspect --import ./dist/instrument.js dist/main.js` 后用 Chrome 打开 `chrome://inspect`。
   - 在 Memory 面板中：先抓一次快照 → 用脚本或 k6（`tests/load/`）反复调用可疑接口 → 强制 GC 后再抓一次 → 用 **Comparison** 视图查看新增最多的对象，沿着 **Retainers** 找到持有它们的代码。
3. **常见原因**：
   - 无上限的缓存或按用户、请求累积的 `Map`。
   - 每个请求都注册、但从不移除的事件监听器（`on(...)` 没有对应的 `off(...)`）。
   - 闭包捕获了大对象（例如整个请求或响应）并被长期保存。
   - 未关闭的连接或队列实例（应在 `main.ts` 的停机流程中关闭）。

## 4. 修复后

发布后观察至少一个流量周期，确认 GC 后的低点不再上移。
