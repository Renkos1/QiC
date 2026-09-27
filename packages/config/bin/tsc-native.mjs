#!/usr/bin/env node
/**
 * Runs the TypeScript 7 native compiler (`typescript-native`) with the given arguments,
 * while `typescript` stays on 6.x for tools that still need the JS compiler API.
 *
 * 类型检查和构建使用 TypeScript 7 原生编译器；`typescript` 包仍停在 6.x，
 * 供仍依赖 JS 编译器 API 的工具（如 openapi-typescript）使用。参数原样透传给 `tsc`。
 *
 * @example tsc-native --noEmit
 */
// TS 7 does not export its bin path, so resolve it through package.json.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const pkgJsonPath = require.resolve("typescript-native/package.json");
const { bin } = require(pkgJsonPath);
const tscPath = path.join(path.dirname(pkgJsonPath), bin.tsc);

const result = spawnSync(process.execPath, [tscPath, ...process.argv.slice(2)], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
