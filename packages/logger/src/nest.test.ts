/*
 * The Nest-to-pino log adapter.
 *
 * Nest 日志到 pino 的适配器。
 */
import type { Logger } from "pino";
import { describe, expect, it, vi } from "vitest";
import { createNestLogger } from "./nest.js";

const fakeLogger = () =>
  ({
    debug: vi.fn(),
    trace: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  }) as unknown as Logger & Record<"debug" | "error", ReturnType<typeof vi.fn>>;

describe("createNestLogger", () => {
  it("should demote Nest's info logs to debug with their context", () => {
    const logger = fakeLogger();
    createNestLogger(logger).log("Mapped {/api/todos, GET} route", "RouterExplorer");
    expect(logger.debug).toHaveBeenCalledWith(
      { context: "RouterExplorer" },
      "Mapped {/api/todos, GET} route",
    );
  });

  it("should keep the stack when Nest reports an error", () => {
    const logger = fakeLogger();
    createNestLogger(logger).error("boom", "Error: boom\n    at x", "ExceptionHandler");
    expect(logger.error).toHaveBeenCalledWith(
      { context: "ExceptionHandler", stack: "Error: boom\n    at x" },
      "boom",
    );
  });
});
