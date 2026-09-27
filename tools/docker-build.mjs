#!/usr/bin/env node
/*
 * Builds the app images locally and reports their sizes.
 *   pnpm docker:build                 all apps, tagged qic-<app>:local and :<git sha>
 *   pnpm docker:build -- api worker   selected apps only
 *
 * 在本地构建应用镜像并输出体积；镜像标记为 qic-<app>:local 和 :<git sha>。
 * 可只构建部分应用；CI 使用同一套 Dockerfile。
 */
import { spawnSync } from "node:child_process";

const APPS = ["api", "worker", "web"];
const requested = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
const apps = requested.length > 0 ? requested : APPS;

const unknown = apps.filter((app) => !APPS.includes(app));
if (unknown.length > 0) {
  process.stderr.write(`Unknown app(s): ${unknown.join(", ")}. Expected: ${APPS.join(", ")}\n`);
  process.exit(2);
}

const run = (command, args, options = {}) =>
  spawnSync(command, args, { encoding: "utf8", stdio: "pipe", ...options });

const gitSha = run("git", ["rev-parse", "--short=12", "HEAD"]).stdout.trim() || "dev";

const sizes = [];
for (const app of apps) {
  process.stdout.write(`\n==> Building qic-${app} (${gitSha})\n`);
  const build = run(
    "docker",
    [
      "build",
      "--file",
      `apps/${app}/Dockerfile`,
      "--build-arg",
      `GIT_SHA=${gitSha}`,
      "--tag",
      `qic-${app}:local`,
      "--tag",
      `qic-${app}:${gitSha}`,
      ".",
    ],
    { stdio: "inherit" },
  );
  if (build.status !== 0) process.exit(build.status ?? 1);
  const bytes = Number(
    run("docker", ["image", "inspect", `qic-${app}:local`, "--format", "{{.Size}}"]).stdout,
  );
  sizes.push({ image: `qic-${app}:${gitSha}`, sizeMB: Math.round(bytes / 1024 / 1024) });
}

process.stdout.write("\nImage sizes (uncompressed):\n");
for (const { image, sizeMB } of sizes) process.stdout.write(`  ${image.padEnd(32)} ${sizeMB} MB\n`);
