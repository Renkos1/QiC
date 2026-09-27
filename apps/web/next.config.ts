import path from "node:path";
import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

/**
 * Next.js configuration: standalone output for the container image, workspace transpilation and the `/api` proxy.
 *
 * Next.js 配置：为容器镜像输出 standalone 产物、编译工作区包，并把 `/api` 代理到 api。
 */
const nextConfig: NextConfig = {
  output: "standalone",
  // Do not advertise the framework in response headers.
  poweredByHeader: false,
  // Trace files from the monorepo root so the standalone output includes workspace packages.
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  // Workspace packages are bundled from TypeScript source (see the "paths" entry in
  // tsconfig.json; Turbopack has no custom export conditions). geist ships
  // next/font/local declarations that must be compiled by Next.
  transpilePackages: ["@qic/ui", "@qic/api-client", "geist"],
  // Same-origin proxy for local runs: the browser only talks to the web origin, so auth
  // cookies are first-party. In deployments Caddy routes /api/* to the api before Next.
  // Rewrites are resolved at build time, hence the plain default instead of getServerEnv().
  rewrites: async () => [
    {
      source: "/api/:path*",
      destination: `${process.env.API_ORIGIN ?? "http://localhost:14000"}/api/:path*`,
    },
  ],
};

// With SENTRY_AUTH_TOKEN (plus SENTRY_ORG and SENTRY_PROJECT) at build time, source maps are
// uploaded to Sentry and the release is injected; without it the build is unchanged.
// 构建时提供 SENTRY_AUTH_TOKEN（及 SENTRY_ORG、SENTRY_PROJECT）则上传 source map 并注入 release；否则构建不受影响。
export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(nextConfig, {
      silent: true,
      sourcemaps: { deleteSourcemapsAfterUpload: true },
      ...(process.env.GIT_SHA && { release: { name: process.env.GIT_SHA } }),
    })
  : nextConfig;
