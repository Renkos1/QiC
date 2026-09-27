/*
 * Next.js server instrumentation hook, run once per server process. Both parts are opt-in
 * through runtime environment variables, so one image works with or without them:
 * OTEL_EXPORTER_OTLP_ENDPOINT enables tracing (server-side fetches to the api carry the
 * trace context) and SENTRY_DSN enables server error reporting.
 *
 * Next.js 服务端插桩钩子，每个服务进程执行一次。两部分都通过运行时环境变量开启，
 * 同一个镜像有无配置都能运行：设置 OTEL_EXPORTER_OTLP_ENDPOINT 开启链路追踪（服务端对 api
 * 的请求会携带 trace 上下文）；设置 SENTRY_DSN 开启服务端错误上报。
 */
import type { Instrumentation } from "next";

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Starts tracing and error reporting for the Node.js runtime.
 *
 * 为 Node.js 运行时启动链路追踪和错误上报。
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    const { registerOTel } = await import("@vercel/otel");
    const apiOrigin = process.env.API_ORIGIN ?? "http://localhost:14000";
    registerOTel({
      serviceName: "web",
      attributes: { "service.version": process.env.GIT_SHA ?? "dev" },
      instrumentationConfig: {
        fetch: {
          // The server's own call to the api (lib/session.ts) carries the web trace context.
          propagateContextUrls: [`${apiOrigin}/api/auth/get-session`],
          // Browser calls relayed by the /api rewrite (local runs) must keep the browser's
          // traceparent; the relay starts no trace of its own and would otherwise replace it.
          dontPropagateContextUrls: [
            new RegExp(`^${escapeRegExp(apiOrigin)}/api/(?!auth/get-session)`),
          ],
        },
      },
    });
  }
  if (process.env.SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      release: process.env.GIT_SHA ?? "dev",
      environment: process.env.NODE_ENV,
      // Errors only; tracing belongs to @vercel/otel above.
      enableOpenTelemetrySetup: false,
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
      },
    });
  }
}

/**
 * Reports errors thrown while rendering or handling a request (Sentry only).
 *
 * 上报渲染或处理请求时抛出的错误（仅在配置 Sentry 时）。
 */
export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
};
