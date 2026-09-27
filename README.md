# QiC

社区与简易智能硬件工作区。

- 架构：monorepo + 模块化单体（`apps/web`、`apps/api`、`apps/worker`）
- 技术栈：TypeScript · pnpm + Turborepo · Next.js · NestJS · BullMQ · PostgreSQL + Drizzle · Redis
- 协作准则：[AGENTS.md](AGENTS.md)；架构与数据流：[docs/architecture.md](docs/architecture.md)；分层、测试与调试指南：[docs/developer-guide.md](docs/developer-guide.md)；选型记录：[docs/adr](docs/adr/)（[0001 工程基座](docs/adr/0001-foundation.md)、[0002 CI/CD](docs/adr/0002-ci-cd.md)）

## 环境准备

工具版本由 [`.mise.toml`](.mise.toml) 锁定（Node、pnpm、oasdiff），请通过 [mise](https://mise.jdx.dev) 安装，不要用全局安装的版本。

### 安装 mise

Windows（PowerShell）：

```powershell
winget install jdx.mise
```

安装后重开终端，并在 PowerShell profile（`notepad $PROFILE`）中加入以下内容，以启用自动切换版本：

```powershell
(&mise activate pwsh) | Out-String | Invoke-Expression
```

Git Bash 用户在 `~/.bashrc` 中加入 `eval "$(mise activate bash)"`。

macOS / Linux：

```bash
curl https://mise.run | sh
```

然后按提示把 `mise activate` 加入 shell 配置文件。

### 或者：使用开发容器

安装了 Docker 与 VS Code 的 Dev Containers 扩展时，可以直接在容器中开发：命令面板执行 **Dev Containers: Reopen in Container**（Windows 上建议用 **Clone Repository in Container Volume**，避免 Linux 与 Windows 的 `node_modules` 混在同一个目录）。容器创建后会自动安装工具与依赖、执行迁移和演示数据，之后直接 `pnpm dev`。配置见 [`.devcontainer/`](.devcontainer/devcontainer.json)。

### 安装工具与依赖

```bash
mise trust && mise install
```

```bash
pnpm install
```

## 本地启动

需要 Docker。默认配置可以直接使用，**不需要**创建 `.env`；需要覆盖时复制 [`.env.example`](.env.example) 为 `.env`。

```bash
docker compose up -d
```

```bash
pnpm db:migrate && pnpm db:seed
```

```bash
pnpm dev
```

`pnpm dev` 同时启动 web、api、worker。打开 http://localhost:13000 注册账号，验证邮件在 Mailpit 中查看。

| 服务 | 地址 |
|---|---|
| Web | http://localhost:13000 |
| API（浏览器通过 web 的 `/api/*` 同域访问） | http://localhost:14000/api |
| PostgreSQL | `postgres://qic:qic@localhost:15432/qic` |
| Redis | `redis://localhost:16379` |
| Mailpit（开发邮箱） | http://localhost:18025（SMTP 11025） |
| Grafana（`docker compose --profile obs up -d`，并设置 `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:14318`） | http://localhost:13001 |
| Bull Board（队列面板，仅开发环境） | http://localhost:14000/admin/queues |

演示账号（由 `pnpm db:seed` 创建，仅限开发环境）：`demo@qic.local` / `demo-password-123`。

web 默认使用 13000 端口。改用其他端口时（例如 `pnpm --filter @qic/web exec next dev --port 13100`），需在 `.env` 中同步设置 `PUBLIC_WEB_URL`，否则 Better Auth 会以 Invalid origin 拒绝请求。经 turbo 启动的应用只会收到 `turbo.json` 中 `globalPassThroughEnv` 声明过的环境变量。

数据库变更流程见 [docs/runbooks/database-migrations.md](docs/runbooks/database-migrations.md)；链路追踪、指标、日志与断点调试见 [docs/developer-guide.md §6](docs/developer-guide.md#6-调试手册)，线上排查手册见 [docs/runbooks](docs/runbooks/README.md)。

## 测试

| 类型 | 命令 | 前置条件 |
|---|---|---|
| 单元测试 | `pnpm test` | 无 |
| 单元测试覆盖率 | `pnpm test:coverage`（报告：`coverage/index.html`，低于下限即失败） | 无 |
| 集成测试（Testcontainers） | `pnpm test:int` | Docker 正在运行（测试会自己启动 Postgres / Redis 容器） |
| 端到端（Playwright） | `pnpm e2e`（仅冒烟：`pnpm --filter @qic/e2e e2e:smoke`） | `docker compose up -d && pnpm db:migrate`；首次运行前执行 `pnpm --filter @qic/e2e e2e:install` 安装浏览器 |
| 压测基线（k6） | `pnpm test:load` | 已运行 `pnpm db:seed`，并启动 api（`pnpm dev`） |
| AI 评测 | `pnpm eval`（记录基线：`pnpm eval -- --update-baseline`） | 设置 `ANTHROPIC_API_KEY`，否则自动跳过 |

端到端测试会在独立端口（web 13200 / api 14200 / worker 14300）上自行启动 web、api、worker，不会与 `pnpm dev` 冲突；失败时 trace 和截图保存在 `tests/e2e/test-results/`，可用 `pnpm --filter @qic/e2e exec playwright show-trace <trace.zip>` 查看。

**排障**：如果 `pnpm test:int` 无法拉取 `testcontainers/ryuk` 镜像，可以临时设置 `TESTCONTAINERS_RYUK_DISABLED=true` 再运行；测试结束时仍会停止自己创建的容器。

## 部署

镜像构建：`pnpm docker:build`（构建 api、worker、web 三个镜像，并输出镜像体积）。单机部署、回滚和本地演练见 [infra/compose/README.md](infra/compose/README.md)。

## CI/CD

| 工作流 | 触发 | 内容 |
|---|---|---|
| [`ci.yml`](.github/workflows/ci.yml) | PR、推送 main | `check`：lint、typecheck + 单元测试（PR 上只跑受影响的包）、依赖规则、契约兼容性、生成文件是否已提交、覆盖率、build；`integration`：Testcontainers 集成测试 |
| [`e2e.yml`](.github/workflows/e2e.yml) | PR、推送 main | PR 跑 `@smoke` 用例（开发服务器）；main 用生产镜像经 `infra/compose/deploy.sh` 部署后跑全量。给 PR 加 `e2e:production` 标签可在 PR 上跑生产全量 |
| [`security.yml`](.github/workflows/security.yml) | PR、推送 main、每周一 | CodeQL、gitleaks、`pnpm audit`；每周另外重新构建镜像并用 Trivy 扫描 |
| [`release.yml`](.github/workflows/release.yml) | 推送 main；修改镜像构建的 PR；手动 | release-please 维护发布 PR 与 CHANGELOG；发布时构建镜像 → Trivy → SBOM；设置 `IMAGE_REGISTRY` 后推送、cosign 签名；设置 `SENTRY_AUTH_TOKEN` 后上传 source map。PR 与手动运行只演练，不发布 |
| [`deploy.yml`](.github/workflows/deploy.yml) | 发布后（`AUTO_DEPLOY`）或手动输入 tag | SSH 到服务器，按 digest 执行 `deploy.sh`（健康检查、冒烟、失败自动回滚）；手动部署旧 tag 即回滚 |

依赖更新由 Renovate（[`.github/renovate.json5`](.github/renovate.json5)）每周一分组提交；minor/patch 在 CI 通过后自动合并。所有 Action 固定到 commit SHA。

### 仓库设置（需人工完成）

以下设置不在代码中，建仓后在 GitHub 页面上配置一次：

1. **main 分支保护（Settings → Rules → Rulesets）**：必须通过 PR 合并；必需检查 `check`、`integration`、`e2e-smoke`、`codeql`、`gitleaks`、`audit`；要求 CODEOWNERS 批准；禁止 force push 与删除。
2. **合并方式（Settings → General）**：只允许 squash merge，合并后自动删除分支。
3. **Actions（Settings → Actions → General）**：勾选 “Allow GitHub Actions to create and approve pull requests”，release-please 才能开发布 PR。GITHUB_TOKEN 开的 PR 不会触发 CI，建议另建 `RELEASE_PLEASE_TOKEN` secret（仅本仓库 Contents/Pull requests 读写的 fine-grained token）。
4. **Renovate**：安装 [Renovate GitHub App](https://github.com/apps/renovate) 并授权本仓库。
5. **安全**：开启 Private vulnerability reporting 与 Dependabot alerts。
6. **发布与部署（按需）**：

| 名称 | 类型 | 作用 |
|---|---|---|
| `IMAGE_REGISTRY` | 变量 | 镜像仓库前缀，如 `ghcr.io/renkos1`；未设置时发布只构建、扫描、生成 SBOM |
| `REGISTRY_USERNAME` / `REGISTRY_PASSWORD` | 变量 / secret | 非 ghcr.io 的镜像仓库凭据（ghcr.io 使用工作流自带 token） |
| `SENTRY_AUTH_TOKEN` | secret | 发布时上传 web source map；同时设置变量 `SENTRY_ORG`、`SENTRY_PROJECT` |
| `NEXT_PUBLIC_SENTRY_DSN` / `NEXT_PUBLIC_OTEL_BROWSER` | 变量 | 编译进浏览器代码的错误上报与追踪开关 |
| `AUTO_DEPLOY` | 变量 | 设为 `true` 时，每次发布后自动调用 `deploy.yml` |
| `production` environment | environment | 配置审批人；secrets `DEPLOY_HOST`、`DEPLOY_USER`、`DEPLOY_SSH_KEY`、`DEPLOY_KNOWN_HOSTS`（`ssh-keyscan <host>` 的输出）；变量 `DEPLOY_PATH`（默认 `/srv/qic`）、`PUBLIC_WEB_URL` |

## 常用命令

完整命令表见 [AGENTS.md §2](AGENTS.md#2-命令唯一入口不要自创命令或绕过脚本)。

```bash
pnpm build
```

## AI 协作

- 规则与命令：[AGENTS.md](AGENTS.md)（`CLAUDE.md` 只是引用它）；各应用目录下的 AGENTS.md 补充该应用的约定。
- Claude Code 的项目权限在 [`.claude/settings.json`](.claude/settings.json)：允许 lint、测试、构建和只读的 pnpm/git 命令；禁止读取 `.env` 等含密钥的文件、`git push --force` 和 `rm -rf`。个人覆盖写在 `.claude/settings.local.json`（不提交）。

推荐接入的 MCP 服务（凭据只放在个人配置中，不要提交到仓库）：

| MCP | 用途 | 接入方式 |
|---|---|---|
| [GitHub](https://github.com/github/github-mcp-server) | 读写 issue、PR、CI 状态 | 远程服务 `https://api.githubcopilot.com/mcp/`，使用个人 token |
| [Playwright](https://github.com/microsoft/playwright-mcp) | 操作浏览器验证页面、复现 e2e 问题 | `npx @playwright/mcp@latest` |
| [Postgres（只读）](https://github.com/crystaldba/postgres-mcp) | 查询数据、分析慢查询 | `postgres-mcp --access-mode=restricted`，连接串 `postgres://qic:qic@localhost:15432/qic`；**只使用 restricted 模式** |
| [Sentry](https://github.com/getsentry/sentry-mcp) | 查看错误、堆栈与 release | 远程服务 `https://mcp.sentry.dev/mcp`（OAuth） |
| [Grafana](https://github.com/grafana/mcp-grafana) | 查询 trace、日志、指标和告警 | `uvx mcp-grafana`，`GRAFANA_URL=http://localhost:13001`（本地 obs profile） |

## License

[MIT](LICENSE)
