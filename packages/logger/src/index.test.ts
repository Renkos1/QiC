/*
 * Logger fields, trace correlation and redaction of secrets. The OTel span is faked via
 * a spy; no SDK is started.
 *
 * 日志固定字段、trace 关联与敏感信息脱敏。OTel span 通过 spy 伪造，不启动 SDK。
 */
import { Writable } from "node:stream";
import { INVALID_SPAN_CONTEXT, trace } from "@opentelemetry/api";
import { pino } from "pino";
import { afterEach, describe, expect, it, vi } from "vitest";
import { REDACT_PATHS, traceFields } from "./index.js";

const capture = () => {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(String(chunk));
      callback();
    },
  });
  return { lines, stream };
};

describe("REDACT_PATHS", () => {
  it("should censor secrets when they appear in logged objects", () => {
    const { lines, stream } = capture();
    const logger = pino({ redact: { paths: REDACT_PATHS, censor: "[REDACTED]" } }, stream);

    logger.info({
      user: { email: "a@b.c", password: "hunter2" },
      req: { headers: { cookie: "s=1" } },
    });

    const line = lines.join("");
    expect(line).not.toContain("hunter2");
    expect(line).not.toContain("s=1");
    expect(line).toContain("a@b.c");
  });
});

describe("traceFields", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should add the active span's ids when a span is active", () => {
    const span = trace.wrapSpanContext({
      traceId: "0af7651916cd43dd8448eb211c80319c",
      spanId: "b7ad6b7169203331",
      traceFlags: 1,
    });
    vi.spyOn(trace, "getActiveSpan").mockReturnValue(span);
    expect(traceFields()).toEqual({
      traceId: "0af7651916cd43dd8448eb211c80319c",
      spanId: "b7ad6b7169203331",
    });
  });

  it("should add nothing when no span is active", () => {
    expect(traceFields()).toEqual({});
  });

  it("should add nothing when the active span context is invalid", () => {
    vi.spyOn(trace, "getActiveSpan").mockReturnValue(trace.wrapSpanContext(INVALID_SPAN_CONTEXT));
    expect(traceFields()).toEqual({});
  });
});
