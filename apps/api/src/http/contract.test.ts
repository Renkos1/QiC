/*
 * Startup-time guards of the contract decorators (misdeclared routes fail fast).
 *
 * 契约装饰器在启动阶段的防护：路由声明有误时立即失败。
 */
import "reflect-metadata";
import { defineRoute } from "@qic/contracts";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ContractBody, ContractQuery, ContractRoute } from "./contract.js";

// These guards fire when a controller class is defined, i.e. at startup, not per request.
describe("contract decorators", () => {
  it("should refuse a route that declares no 2xx response", () => {
    const route = defineRoute({
      method: "get",
      path: "/broken",
      responses: { 404: { description: "never succeeds" } },
    });
    expect(() => ContractRoute(route)).toThrow("GET /broken declares no 2xx response");
  });

  it("should refuse an unsupported HTTP method", () => {
    const route = defineRoute({
      method: "options",
      path: "/x",
      responses: { 204: { description: "ok" } },
    });
    expect(() => ContractRoute(route)).toThrow("unsupported method");
  });

  it("should refuse to bind a body the contract does not declare", () => {
    const route = defineRoute({
      method: "post",
      path: "/x",
      responses: { 200: { description: "" } },
    });
    expect(() => ContractBody(route)).toThrow("has no zod body schema");
  });

  it("should accept a query schema declared in the contract", () => {
    const route = defineRoute({
      method: "get",
      path: "/x",
      request: { query: z.object({ q: z.string() }) },
      responses: { 200: { description: "" } },
    });
    expect(() => ContractQuery(route)).not.toThrow();
  });
});
