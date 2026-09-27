/**
 * Dependency direction rules from AGENTS.md §3. Paths are repo-relative. Run with `pnpm deps:check`.
 *
 * AGENTS.md §3 的依赖方向规则（路径相对仓库根目录），由 `pnpm deps:check` 执行，违反即失败。
 *
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Circular dependencies make modules impossible to reason about in isolation.",
      from: {},
      to: { circular: true },
    },
    {
      name: "packages-not-to-apps",
      severity: "error",
      comment: "Shared packages must not depend on deployable apps.",
      from: { path: "^(packages|contracts)/" },
      to: { path: "^apps/" },
    },
    {
      name: "contracts-standalone",
      severity: "error",
      comment: "contracts is the source of truth; it must not depend on implementation packages.",
      from: { path: "^contracts/" },
      to: { path: "^packages/(?!config/)" },
    },
    {
      name: "no-app-to-app",
      severity: "error",
      comment: "Apps talk to each other only through HTTP contracts or queue events.",
      from: { path: "^apps/([^/]+)/" },
      to: { path: "^apps/", pathNot: "^apps/$1/" },
    },
    {
      name: "no-deep-module-import",
      severity: "error",
      comment: "Domain modules are only reachable through their index.ts.",
      from: { path: "^(apps/[^/]+/src/modules)/([^/]+)/" },
      to: {
        path: "^apps/[^/]+/src/modules/[^/]+/",
        pathNot: ["^$1/$2/", "^apps/[^/]+/src/modules/[^/]+/index.ts$"],
      },
    },
    {
      name: "not-to-unresolvable",
      severity: "error",
      comment:
        "Imports must resolve; a typo or missing dependency fails here instead of at runtime.",
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: "no-undeclared-dependency",
      severity: "error",
      comment: "Every npm import must be declared in the importing package's package.json.",
      from: {},
      to: { dependencyTypes: ["npm-no-pkg", "npm-unknown"] },
    },
  ],
  options: {
    // Sources to cruise are passed on the command line (see root "deps:check").
    exclude: {
      path: [
        // Package-local node_modules symlinks; resolved npm targets (node_modules/.pnpm) stay visible.
        "^(apps/[^/]+|packages/[^/]+|contracts)/node_modules/",
        "(^|/)(dist|\\.next|\\.turbo|coverage)/",
      ],
    },
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    // Only apps/web uses tsconfig "paths" (the "@/" alias); other packages resolve via package exports.
    tsConfig: { fileName: "tsconfig.depcruise.json" },
    combinedDependencies: false,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["@qic/source", "import", "require", "node", "default", "types"],
      mainFields: ["module", "main", "types", "typings"],
    },
    moduleSystems: ["es6", "cjs"],
    progress: { type: "none" },
  },
};
