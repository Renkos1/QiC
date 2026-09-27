/*
 * Readiness checks: parallel execution and per-check timeouts.
 *
 * 就绪检查：并行执行与单项超时。
 */
import { describe, expect, it } from "vitest";
import { checkReadiness } from "./readiness.js";

describe("checkReadiness", () => {
  it("should be ok when every check resolves", async () => {
    expect(await checkReadiness({ a: async () => {}, b: async () => {} })).toEqual({
      status: "ok",
      checks: { a: "ok", b: "ok" },
    });
  });

  it("should mark a hanging check unavailable once the timeout passes", async () => {
    const report = await checkReadiness(
      { fast: async () => {}, hung: () => new Promise<void>(() => {}) },
      20,
    );
    expect(report).toEqual({ status: "unavailable", checks: { fast: "ok", hung: "unavailable" } });
  });

  it("should be ok when there is nothing to check", async () => {
    expect((await checkReadiness({})).status).toBe("ok");
  });
});
