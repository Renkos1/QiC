/*
 * Invariants every API route must keep (unique operationId, one 2xx, auth), plus job payloads.
 *
 * 所有 API 路由必须满足的约束（operationId 唯一、只有一个 2xx、需要鉴权），以及队列负载。
 */
import { describe, expect, it } from "vitest";
import { DeadLetterJobSchema } from "./jobs/dead-letter.js";
import { TodoCompletedJobSchema } from "./jobs/notifications.js";
import { apiRoutes } from "./openapi.js";

describe("api routes", () => {
  it("should give every route a unique operationId (client method names depend on it)", () => {
    const ids = apiRoutes.map((route) => route.operationId);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("should declare exactly one success status per route", () => {
    for (const route of apiRoutes) {
      const success = Object.keys(route.responses).filter((code) => code.startsWith("2"));
      expect(success, `${route.method} ${route.path}`).toHaveLength(1);
    }
  });

  it("should require the session cookie and document 401 on every route", () => {
    for (const route of apiRoutes) {
      expect(route.security, `${route.method} ${route.path}`).toEqual([{ cookieAuth: [] }]);
      expect(Object.keys(route.responses), `${route.method} ${route.path}`).toContain("401");
    }
  });
});

describe("job payloads", () => {
  const completed = {
    todoId: "0b8a3f5e-6c1d-4a8e-9f3b-2d7c1e5a9b40",
    userId: "u1",
    title: "milk",
    to: "a@example.com",
    name: "A",
    url: "http://localhost:13000/examples/todos",
  };

  it("should accept a complete todo-completed payload", () => {
    expect(TodoCompletedJobSchema.safeParse(completed).success).toBe(true);
  });

  it.each(["todoId", "to", "url"] as const)(
    "should reject a todo-completed payload with an invalid %s",
    (field) => {
      expect(TodoCompletedJobSchema.safeParse({ ...completed, [field]: "x" }).success).toBe(false);
    },
  );

  it("should keep any original payload in a dead letter", () => {
    const letter = {
      queue: "email",
      jobName: "send-email",
      data: { anything: [1, 2] },
      failedReason: "smtp down",
      attemptsMade: 5,
      failedAt: "2026-09-27T00:00:00.000Z",
    };
    expect(DeadLetterJobSchema.parse(letter)).toEqual(letter);
  });
});
