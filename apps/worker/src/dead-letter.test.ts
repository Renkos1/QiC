/*
 * Dead-letter decisions (final vs retryable failure) and the recorded payload.
 *
 * 死信判断（最终失败还是可重试）与记录的负载。
 */
import type { Logger } from "@qic/logger";
import { type Job, UnrecoverableError } from "bullmq";
import { describe, expect, it, vi } from "vitest";
import { createDeadLetterSink, isFinalFailure, toDeadLetter } from "./dead-letter.js";

const job = (attemptsMade: number, attempts?: number) => ({
  attemptsMade,
  opts: attempts === undefined ? {} : { attempts },
});

describe("isFinalFailure", () => {
  it("should be false when attempts remain", () => {
    expect(isFinalFailure(job(2, 5), new Error("smtp down"))).toBe(false);
  });

  it("should be true when the last attempt failed", () => {
    expect(isFinalFailure(job(5, 5), new Error("smtp down"))).toBe(true);
  });

  it("should be true when the error is unrecoverable even with attempts left", () => {
    expect(isFinalFailure(job(1, 5), new UnrecoverableError("bad payload"))).toBe(true);
  });

  it("should treat a job without attempts as single-shot", () => {
    expect(isFinalFailure(job(1), new Error("x"))).toBe(true);
  });
});

describe("toDeadLetter", () => {
  it("should keep the original payload and failure metadata", () => {
    const now = new Date("2026-09-24T00:00:00.000Z");
    const letter = toDeadLetter(
      "email",
      { name: "send-email", id: "7", data: { to: "a@b.c" }, attemptsMade: 5 },
      new Error("smtp down"),
      now,
    );

    expect(letter).toEqual({
      queue: "email",
      jobName: "send-email",
      jobId: "7",
      data: { to: "a@b.c" },
      failedReason: "smtp down",
      attemptsMade: 5,
      failedAt: "2026-09-24T00:00:00.000Z",
    });
  });
});

describe("createDeadLetterSink", () => {
  const logger = { warn: vi.fn(), error: vi.fn(), fatal: vi.fn() } as unknown as Logger;
  const failed = (attemptsMade: number) =>
    ({ id: "9", name: "send-email", data: {}, attemptsMade, opts: { attempts: 3 } }) as Job;

  it("should neither dead-letter nor report a job that will be retried", () => {
    const add = vi.fn(async () => undefined);
    const errors = { capture: vi.fn() };
    createDeadLetterSink({ add } as never, logger, errors).record(
      "email",
      failed(1),
      new Error("x"),
    );
    expect(add).not.toHaveBeenCalled();
    expect(errors.capture).not.toHaveBeenCalled();
  });

  it("should dead-letter and report a job after its last attempt", () => {
    const add = vi.fn(async () => undefined);
    const errors = { capture: vi.fn() };
    const error = new Error("x");
    createDeadLetterSink({ add } as never, logger, errors).record("email", failed(3), error);
    expect(add).toHaveBeenCalledWith("email:send-email", expect.objectContaining({ jobId: "9" }));
    // The report carries identifiers only, never the job payload.
    expect(errors.capture).toHaveBeenCalledWith(error, {
      queue: "email",
      jobId: "9",
      jobName: "send-email",
      attemptsMade: 3,
    });
  });
});
