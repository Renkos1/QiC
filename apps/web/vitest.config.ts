import path from "node:path";
import { unitPreset } from "@qic/config/vitest";
import { defineConfig, mergeConfig } from "vitest/config";

/**
 * Unit tests for web. Component tests opt into jsdom per file (`@vitest-environment jsdom`).
 *
 * web 的单元测试配置。组件测试在文件头用 `@vitest-environment jsdom` 单独启用浏览器环境。
 */
export default mergeConfig(
  unitPreset,
  defineConfig({
    // Mirrors the "@/" path alias in tsconfig.json. 与 tsconfig.json 中的 "@/" 别名一致。
    resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
    // Next compiles JSX itself (tsconfig "jsx": "preserve"); tests need the React runtime.
    // Next 自己编译 JSX（tsconfig 为 preserve），测试需要 React 自动运行时。
    oxc: { jsx: { runtime: "automatic" } },
  }),
);
