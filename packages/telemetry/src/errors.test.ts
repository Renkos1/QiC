/*
 * Sentry-backed error reporter. @sentry/node is mocked, so nothing is sent; the tests
 * check when Sentry is initialised and what each report carries.
 *
 * 基于 Sentry 的错误上报器。@sentry/node 被模拟，不会真正发送；测试检查何时初始化
 * Sentry 以及每次上报携带的内容。
 */
import { trace } from "@opentelemetry/api";
import * as Sentry from "@sentry/node";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createErrorReporter } from "./errors.js";

vi.mock("@sentry/node", () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  flush: vi.fn(async () => true),
}));

const logger = { info: vi.fn() };
const options = { service: "api", release: "abc123", environment: "production", logger };
const DSN = "https://key@example.invalid/1";

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("createErrorReporter", () => {
  it("should stay disabled and say so when no DSN is set", () => {
    const reporter = createErrorReporter({ ...options, dsn: undefined });
    reporter.capture(new Error("boom"));
    expect(reporter.enabled).toBe(false);
    expect(Sentry.init).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith("SENTRY_DSN not set; error reporting disabled");
  });

  it("should initialise Sentry with the release and without personal data when a DSN is set", () => {
    const reporter = createErrorReporter({ ...options, dsn: DSN });
    expect(reporter.enabled).toBe(true);
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        release: "abc123",
        environment: "production",
        initialScope: { tags: { service: "api" } },
        dataCollection: expect.objectContaining({ userInfo: false, httpBodies: [] }),
      }),
    );
  });

  it("should attach the active trace id and context to each report", () => {
    vi.spyOn(trace, "getActiveSpan").mockReturnValue(
      trace.wrapSpanContext({
        traceId: "0af7651916cd43dd8448eb211c80319c",
        spanId: "b7ad6b7169203331",
        traceFlags: 1,
      }),
    );
    const reporter = createErrorReporter({ ...options, dsn: DSN });
    const error = new Error("boom");
    reporter.capture(error, { queue: "email" });
    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      tags: { traceId: "0af7651916cd43dd8448eb211c80319c" },
      extra: { queue: "email" },
    });
  });

  it("should wait for pending reports on flush", async () => {
    const reporter = createErrorReporter({ ...options, dsn: DSN });
    await reporter.flush(500);
    expect(Sentry.flush).toHaveBeenCalledWith(500);
  });
});
