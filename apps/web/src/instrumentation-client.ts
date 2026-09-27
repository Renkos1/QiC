/*
 * Next.js browser instrumentation, run before the app hydrates. Browser code cannot read
 * runtime environment variables, so both parts are switched on at build time and loaded
 * lazily (nothing is downloaded when they are off):
 * NEXT_PUBLIC_SENTRY_DSN enables browser error reporting; NEXT_PUBLIC_OTEL_BROWSER=true
 * enables browser tracing, exported through this app's /otlp relay.
 *
 * Next.js 浏览器端插桩，在应用水合之前执行。浏览器代码无法读取运行时环境变量，
 * 因此两部分都在构建时开启，并按需懒加载（关闭时不会下载任何代码）：
 * 设置 NEXT_PUBLIC_SENTRY_DSN 开启浏览器错误上报；设置 NEXT_PUBLIC_OTEL_BROWSER=true
 * 开启浏览器链路追踪，经本应用的 /otlp 中转导出。
 */

// Monitoring is best effort: a blocked or failed download must never break the page.
const ignoreTelemetryFailure = () => {};

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  import("@sentry/nextjs")
    .then((Sentry) => {
      Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        // Unset: the release injected by withSentryConfig at build time (next.config.ts) is used.
        release: process.env.NEXT_PUBLIC_RELEASE,
        environment: process.env.NODE_ENV,
        dataCollection: {
          userInfo: false,
          cookies: false,
          httpHeaders: false,
          httpBodies: [],
          urlQueryParams: false,
        },
      });
    })
    .catch(ignoreTelemetryFailure);
}

if (process.env.NEXT_PUBLIC_OTEL_BROWSER === "true") {
  import("./lib/browser-tracing")
    .then(({ startBrowserTracing }) => startBrowserTracing())
    .catch(ignoreTelemetryFailure);
}
