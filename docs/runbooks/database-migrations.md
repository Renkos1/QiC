# Runbook：数据库迁移（expand/contract）

适用范围：所有修改 `packages/db/src/schema/**` 的变更。规则来源：[AGENTS.md §10](../../AGENTS.md)。

## 基本流程

1. 修改 `packages/db/src/schema/` 中的 Drizzle schema。
2. 生成迁移：`pnpm db:generate --name <简短描述>`，产物位于 `packages/db/migrations/`。
3. **人工审阅**生成的 SQL：确认没有意外的 `DROP`、没有全表重写、没有长时间持锁的操作。
4. 本地验证：`pnpm db:migrate`，并运行 `pnpm test:int`。
5. 迁移文件与 `migrations/meta/` 快照一起提交。**已合并到 main 的迁移文件禁止修改**；需要修正时新增一个迁移。

迁移按 `migrations/meta/_journal.json` 的顺序执行，已执行的迁移记录在 `drizzle.__drizzle_migrations` 表中，所以重复执行 `pnpm db:migrate` 不会产生任何变化。

## 为什么要 expand/contract

部署期间新旧两个版本的应用会同时访问同一个数据库（滚动更新、回滚）。因此每个迁移都必须**同时兼容当前线上版本和即将发布的版本**。破坏性改动（删列、改名、改类型、加 NOT NULL）要拆到多次发布里完成。

## 操作步骤：以“把 `todos.title` 改名为 `todos.summary`”为例

| 发布 | 迁移（expand / contract） | 应用代码 |
|---|---|---|
| **R1 expand** | 新增可空列 `summary` | 写入时**双写** `title` 和 `summary`；读取仍用 `title` |
| **R1 回填** | 不放进迁移文件（迁移在单个事务中执行）；由一次性脚本或 worker 任务分批回填：`UPDATE todos SET summary = title WHERE summary IS NULL AND id IN (SELECT id FROM todos WHERE summary IS NULL LIMIT 1000)`，循环直到影响 0 行 | 不变 |
| **R2 切换读** | 如需约束：先 `ADD CONSTRAINT ... CHECK (summary IS NOT NULL) NOT VALID`，再 `VALIDATE CONSTRAINT`，最后 `SET NOT NULL` | 读取改用 `summary`；继续双写 |
| **R3 contract** | 停止写 `title` 并发布后，下一次发布再 `DROP COLUMN title` | 删除所有对 `title` 的引用 |

每一步都要确认：**上一版本应用在新 schema 上能正常运行**。只有这样，出问题时才能直接回滚应用镜像，而不用回滚数据库。

## 常见操作的安全写法

| 操作 | 危险写法 | 安全写法 |
|---|---|---|
| 加列 | `ADD COLUMN x NOT NULL`（无默认值） | 先加可空列 → 回填 → 按上表方式加 NOT NULL |
| 加索引（大表） | `CREATE INDEX`（阻塞写入） | 迁移在事务中执行，无法使用 `CONCURRENTLY`。先在维护窗口手动执行 `CREATE INDEX CONCURRENTLY IF NOT EXISTS ...`，再提交使用 `CREATE INDEX IF NOT EXISTS` 的迁移（此时为空操作） |
| 加外键 | `ADD CONSTRAINT ... FOREIGN KEY`（全表校验并持锁） | `... NOT VALID`，再单独执行 `VALIDATE CONSTRAINT` |
| 删列 / 删表 | 与读取它的代码同一次发布 | 先发布不再读写它的代码，下一次发布再删 |
| 改类型 | `ALTER COLUMN TYPE`（可能全表重写） | 新增列 + 双写 + 回填 + 切换，按改名流程处理 |

大表回填必须分批，并在批次之间留出间隔，避免长事务和复制延迟。

## 回滚

- **应用回滚**：因为每一步迁移都向前兼容，所以直接回滚到上一个镜像即可，不需要回滚数据库。
- **迁移本身失败**：Drizzle 在一个事务中执行本次所有待执行的迁移，失败时整体回滚且不会记录，修复后重新执行 `pnpm db:migrate` 即可。手动执行的 `CREATE INDEX CONCURRENTLY` 失败会留下 `INVALID` 状态的索引，需要先 `DROP INDEX CONCURRENTLY` 再重试。
- **数据修复**：属于必须先征得人类确认的操作（AGENTS.md §15）。操作前先备份（`pg_dump`），修复脚本要经过 review。

## 本地重置

```bash
docker compose down -v
```

```bash
docker compose up -d && pnpm db:migrate && pnpm db:seed
```
