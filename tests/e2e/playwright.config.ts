import { defineConfig, devices } from "@playwright/test";

/**
 * Runs the real stack (web + api + worker) on dedicated ports so it never collides with
 * `pnpm dev`. Postgres, Redis and Mailpit come from `docker compose up -d` (migrated).
 *
 * 在独立端口（web 13200、api 14200、worker 14300）上启动真实的 web + api + worker，不与 `pnpm dev` 冲突。
 * Postgres、Redis 和 Mailpit 来自 `docker compose up -d`（需先迁移）。
 */
const WEB_PORT = 13200;
const API_PORT = 14200;
const WEB_URL = `http://localhost:${WEB_PORT}`;
const isCI = Boolean(process.env.CI);
/**
 * Set to test an already-running deployment (e.g. the infra/compose rehearsal at
 * https://localhost:18443) instead of starting the stack locally.
 *
 * 设置后改为测试已运行的部署（例如 infra/compose 本地演练 https://localhost:18443），不在本地启动服务。
 */
const externalBaseUrl = process.env.E2E_BASE_URL;

const stackEnv = {
  NODE_ENV: "test",
  LOG_LEVEL: "warn",
  PUBLIC_WEB_URL: WEB_URL,
  API_ORIGIN: `http://localhost:${API_PORT}`,
};

// On Linux Playwright stops a server by SIGKILL to its process group, but `pnpm exec` runs the
// command in a group of its own: the server survives, keeps the output pipe open and teardown
// waits forever. pnpm forwards SIGTERM to that group, and the apps shut down on it.
const gracefulShutdown = { signal: "SIGTERM", timeout: 10_000 } as const;

/** Playwright configuration (Chromium only). Playwright 配置（仅 Chromium）。 */
export default defineConfig({
  testDir: "./specs",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  // CI logs only show complete lines, so `list` (one line per test) makes progress visible.
  reporter: isCI ? [["github"], ["list"], ["html", { open: "never" }]] : [["list"]],
  timeout: 60_000,
  // A stuck run fails with a report instead of being killed by the job timeout.
  globalTimeout: isCI ? 15 * 60_000 : 0,
  expect: { timeout: 15_000 },
  use: {
    baseURL: externalBaseUrl ?? WEB_URL,
    // Local rehearsals use Caddy's internal CA.
    ignoreHTTPSErrors: Boolean(externalBaseUrl),
    locale: "zh-CN",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: externalBaseUrl
    ? undefined
    : [
        {
          name: "api",
          command: "pnpm --filter @qic/api exec tsx --conditions=@qic/source src/main.ts",
          cwd: "../..",
          url: `http://localhost:${API_PORT}/readyz`,
          env: { ...stackEnv, PORT: String(API_PORT) },
          reuseExistingServer: !isCI,
          timeout: 60_000,
          gracefulShutdown,
        },
        {
          name: "worker",
          command: "pnpm --filter @qic/worker exec tsx --conditions=@qic/source src/main.ts",
          cwd: "../..",
          // "worker started" is an info line, and it is what readiness waits for.
          env: { ...stackEnv, LOG_LEVEL: "info", WORKER_HEALTH_PORT: "14300" },
          wait: { stdout: /worker started/ },
          timeout: 60_000,
          gracefulShutdown,
        },
        {
          name: "web",
          command: `pnpm --filter @qic/web exec next dev --port ${WEB_PORT}`,
          cwd: "../..",
          url: `${WEB_URL}/sign-in`,
          env: stackEnv,
          reuseExistingServer: !isCI,
          timeout: 120_000,
          gracefulShutdown,
        },
      ],
});
