/**
 * Fails when `openapi/openapi.json` has breaking changes compared to the base branch.
 * Base ref: `$CONTRACTS_BASE_REF`, else `origin/main`, else `main`. Requires `oasdiff`.
 *
 * 契约兼容性检查：与基线分支的 `openapi.json` 对比，发现破坏性变更时以非零码退出。
 * 基线依次取 `$CONTRACTS_BASE_REF`、`origin/main`、`main`；需要先 `mise install` 安装 oasdiff。
 * 基线里还没有该文件时（首次提交）直接通过。
 *
 * @example pnpm contracts:check
 */
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SPEC_PATH_IN_REPO = "contracts/openapi/openapi.json";
const specFile = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../openapi/openapi.json",
);

const git = (...args: string[]) =>
  spawnSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

const refExists = (ref: string) =>
  git("rev-parse", "--verify", "--quiet", `${ref}^{commit}`).status === 0;

const resolveBaseRef = (): string | undefined => {
  const fromEnv = process.env.CONTRACTS_BASE_REF;
  if (fromEnv) return fromEnv;
  return ["origin/main", "main"].find(refExists);
};

const log = (message: string) => process.stdout.write(`[contracts:check] ${message}\n`);

const baseRef = resolveBaseRef();
if (!baseRef) {
  log("No base ref (origin/main or main) found; skipping.");
  process.exit(0);
}

const baseSpec = git("show", `${baseRef}:${SPEC_PATH_IN_REPO}`);
if (baseSpec.status !== 0) {
  // First contract ever: nothing to be compatible with yet.
  log(`${SPEC_PATH_IN_REPO} does not exist on ${baseRef}; no baseline, skipping.`);
  process.exit(0);
}

const tmpDir = await mkdtemp(path.join(os.tmpdir(), "contracts-check-"));
try {
  const baseFile = path.join(tmpDir, "base.json");
  await writeFile(baseFile, baseSpec.stdout, "utf8");

  log(`Comparing against ${baseRef}`);
  const result = spawnSync("oasdiff", ["breaking", baseFile, specFile, "--fail-on", "ERR"], {
    stdio: "inherit",
  });
  if (result.error) {
    log(`Could not run oasdiff (${result.error.message}). Run \`mise install\` first.`);
    process.exitCode = 1;
  } else if (result.status !== 0) {
    log("Breaking changes detected. See AGENTS.md §9 for the compatibility process.");
    process.exitCode = result.status ?? 1;
  } else {
    log("No breaking changes.");
  }
} finally {
  await rm(tmpDir, { recursive: true, force: true });
}
