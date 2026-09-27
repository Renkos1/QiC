## 动机 / Why

<!-- 解决什么问题；关联 issue：Closes #123 -->

## 改动 / What

<!-- 主要改动；涉及契约、数据库 schema、依赖、鉴权时单独说明（AGENTS.md §15） -->

## 验证 / How it was verified

<!-- 运行的命令与结果；UI 改动附截图；修 bug 附上先失败后通过的测试 -->

## 风险与回滚 / Risk and rollback

<!-- 影响范围、迁移是否可在线执行、如何回滚 -->

---

- [ ] `pnpm check` 通过，没有新增 warning
- [ ] 新行为有测试；bug 修复有回归测试
- [ ] 契约、生成代码、迁移文件已更新并提交
- [ ] 新代码路径有日志、trace、指标（AGENTS.md §12）
- [ ] README / AGENTS.md / runbook / ADR 已同步
