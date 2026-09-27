#!/usr/bin/env bash
# Runs once after the dev container is created: installs the pinned tools and
# dependencies, then prepares the database. Safe to re-run.
# 开发容器创建后执行一次：安装锁定版本的工具和依赖，然后准备数据库。可重复执行。
set -euo pipefail

# The checkout may be owned by another user (bind mount); git would then refuse to run,
# and the "prepare" script (lefthook install) needs git.
git config --global --add safe.directory "$PWD"

mise trust
mise install
eval "$(mise env -s bash)"

pnpm install --frozen-lockfile
pnpm db:migrate
pnpm db:seed

echo "Ready: run 'pnpm dev', then open http://localhost:13000"
echo "For e2e tests, install a browser once: pnpm --filter @qic/e2e exec playwright install --with-deps chromium"
