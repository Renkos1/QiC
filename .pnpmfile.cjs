// pnpm install hook: narrows third-party manifests before resolution.
//
// better-auth declares optional peers for every framework integration it ships. pnpm
// resolves an optional peer whenever a matching version exists anywhere in the
// workspace, so the api's better-auth picked up web's `next` (and through it Playwright),
// test tooling and drizzle-kit, bloating the api/worker images with unused code.
// We only use the core, the drizzle adapter and `better-auth/react`, so drop the rest.
//
// pnpm 安装钩子：在解析依赖前收窄第三方包的清单。better-auth 为每个框架集成都声明了可选 peer，
// pnpm 只要在工作区任何地方找到匹配版本就会解析它，导致 api 的依赖带上 web 的 next（进而带上 Playwright）
// 等无关代码，使镜像膨胀（api 从 188 MB 降到约 74 MB）。我们只用核心、drizzle 适配器和 `better-auth/react`。
// 修改本文件后 lockfile 中的校验和会变化；Dockerfile 会单独复制本文件（turbo prune 不包含它）。
const UNUSED_BETTER_AUTH_PEERS = [
  "next",
  "vitest",
  "drizzle-kit",
  "@lynx-js/react",
  "@prisma/client",
  "prisma",
  "@sveltejs/kit",
  "svelte",
  "@tanstack/react-start",
  "@tanstack/solid-start",
  "solid-js",
  "vue",
  "mongodb",
  "mysql2",
];

function readPackage(pkg) {
  if (pkg.name === "better-auth") {
    for (const name of UNUSED_BETTER_AUTH_PEERS) {
      delete pkg.peerDependencies?.[name];
      delete pkg.peerDependenciesMeta?.[name];
    }
  }
  return pkg;
}

module.exports = { hooks: { readPackage } };
