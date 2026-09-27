import { defaultServerConditions } from "vite";
import { defineConfig } from "vitest/config";

// Resolve workspace packages to their TypeScript sources (the "@qic/source" export
// condition), like typecheck and tsx do, so tests never run against a stale dist build.
const conditions = [
  "@qic/source",
  // "module" points some packages at bundler-only ESM builds (directory imports) that
  // Node cannot load once vitest externalizes them; vitest leaves it out by default too.
  ...defaultServerConditions.filter((condition) => condition !== "module"),
];

const sourceConditions = {
  resolve: { conditions },
  ssr: { resolve: { conditions } },
};

/**
 * Vitest preset for unit tests: pure logic next to the source, no network or database.
 * Integration tests (`*.int.test.ts`) are excluded and run via {@link integrationPreset}.
 *
 * 单元测试预设：测试文件与源码同目录，只测纯逻辑，不访问网络和数据库。
 * `*.int.test.ts` 被排除，由 {@link integrationPreset} 运行。各包的 `vitest.config.ts` 直接导出它。
 */
export const unitPreset = defineConfig({
  ...sourceConditions,
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.int.test.ts"],
    environment: "node",
    passWithNoTests: true,
    restoreMocks: true,
  },
});

/**
 * Vitest preset for integration tests: real Postgres/Redis via Testcontainers, so they get
 * longer timeouts and run files sequentially to keep container usage predictable.
 *
 * 集成测试预设：通过 Testcontainers 启动真实的 Postgres/Redis，
 * 因此超时更长，并按文件串行执行，避免同时启动过多容器。需要 Docker。
 */
export const integrationPreset = defineConfig({
  ...sourceConditions,
  test: {
    include: ["src/**/*.int.test.ts"],
    environment: "node",
    passWithNoTests: true,
    testTimeout: 60_000,
    hookTimeout: 180_000,
    fileParallelism: false,
  },
});
