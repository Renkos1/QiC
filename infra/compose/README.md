# 单机部署（docker compose + Caddy）

生产环境是一台服务器上的一组容器：Caddy（唯一对外暴露端口，自动 HTTPS）→ web / api；worker、Postgres、Redis 只在内部网络中通信。每次发布都按镜像 **digest** 部署，回滚也只是切回上一组 digest。

| 文件 | 作用 |
|---|---|
| `docker-compose.prod.yml` | 生产服务定义（只读文件系统、非 root 运行、健康检查、`migrate` 一次性任务） |
| `Caddyfile` | `/api/*` → api，其余 → web；`/healthz`、`/readyz` 不对外暴露；安全响应头 |
| `.env.prod.example` | 环境变量模板，复制为 `.env.prod`（不入库） |
| `deploy.sh` / `rollback.sh` / `smoke.sh` | 部署、回滚、部署后冒烟检查 |

这三个脚本在服务器上运行，使用 POSIX `sh`。这是“仓库脚本用 Node 编写”规则的例外：服务器上不一定安装了 Node。

## 首次准备服务器

1. 安装 Docker Engine 和 compose 插件，开放 80、443 端口，把域名的 DNS 指向这台服务器。
2. 把本目录复制到服务器（例如 `/srv/qic`），复制 `.env.prod.example` 为 `.env.prod` 并填写所有值，然后执行 `chmod 600 .env.prod`。
3. 登录镜像仓库：`docker login <registry>`。

## 发布

```bash
./deploy.sh <registry>/qic-api@sha256:… <registry>/qic-worker@sha256:… <registry>/qic-web@sha256:…
```

通常不需要手动执行：`.github/workflows/deploy.yml` 会把本目录的文件复制到服务器，再用发布附带的 `images.env`（镜像 digest）调用 `deploy.sh`；手动运行该工作流并输入旧 tag 即可回滚到旧版本。所需的 secrets 与审批设置见根目录 README 的“仓库设置”。

`deploy.sh` 的执行步骤：

1. 把当前运行的镜像记录到 `.env.images.previous`。
2. 拉取新镜像。
3. 启动服务：先运行 `migrate`，再依次启动 api、worker、web、Caddy，并等待所有健康检查通过（最长 180 秒）。
4. 运行 `smoke.sh`，经过 Caddy 检查首页、API 和内部端点。
5. 第 3 步或第 4 步失败时，自动执行 `rollback.sh`。

数据库迁移遵循 expand/contract（见 [runbook](../../docs/runbooks/database-migrations.md)），旧镜像可以在新 schema 上正常运行，所以回滚时不会动数据库。

## 手动回滚

```bash
./rollback.sh
```

回滚后，失败版本的镜像列表保存在 `.env.images.failed`，方便排查。

## 本地演练（与生产使用同一套文件）

```bash
pnpm docker:build
```

然后在本目录创建 `.env.prod`（`SITE_ADDRESS=localhost`，`HTTP_PORT` / `HTTPS_PORT` 选择空闲端口，`PUBLIC_WEB_URL=https://localhost:<HTTPS_PORT>`，`SMTP_URL=smtp://host.docker.internal:11025` 使用开发环境的 Mailpit），再执行：

```bash
SKIP_PULL=1 SMOKE_INSECURE=1 ./deploy.sh qic-api:local qic-worker:local qic-web:local
```

对演练环境运行端到端测试。测试会从同一个 IP 快速注册、登录多个用户，会触发登录/注册限流，所以先在 `.env.prod` 中加入 `RATE_LIMIT_ENABLED=false` 并重新执行 `deploy.sh`，测完再删掉这一行：

```bash
E2E_BASE_URL=https://localhost:<HTTPS_PORT> pnpm e2e
```

结束后清理：

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod --env-file .env.images down -v
```

compose 项目名是 `qic-prod`，与开发环境的 `qic` 分开，`--remove-orphans` 不会误删开发容器。
