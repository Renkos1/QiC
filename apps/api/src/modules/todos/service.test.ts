/*
 * The todo service with an in-memory repository and idempotency store: pagination,
 * per-user isolation, idempotent create, notifications and AI degradation. No framework.
 *
 * 待办服务测试（内存仓储与内存幂等存储）：分页、用户隔离、幂等创建、完成通知和 AI 降级。不启动框架。
 */
import type { TodoCompletedJob } from "@qic/contracts";
import type { TodoRow } from "@qic/db";
import type { Logger } from "@qic/logger";
import { describe, expect, it, vi } from "vitest";
import type { Actor } from "../../auth/actor.js";
import { ProblemError } from "../../http/problem.js";
import { createMemoryIdempotencyStore } from "../../lib/idempotency.js";
import type { TodoRepo } from "./repo.js";
import { decodeCursor, encodeCursor } from "./schema.js";
import { createTodoService, type TodoServiceDeps } from "./service.js";

const alice: Actor = { id: "alice", name: "Alice", email: "alice@example.com" };
const bob: Actor = { id: "bob", name: "Bob", email: "bob@example.com" };
const logger = { error: vi.fn(), warn: vi.fn() } as unknown as Logger;

/** In-memory repo with the same per-user scoping and ordering as the SQL one. */
const memoryRepo = (): TodoRepo & { rows: TodoRow[] } => {
  const rows: TodoRow[] = [];
  let tick = Date.parse("2026-01-01T00:00:00.000Z");
  const newest = (a: TodoRow, b: TodoRow) =>
    b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id);
  const owned = (userId: string, id: string) =>
    rows.find((row) => row.userId === userId && row.id === id);
  return {
    rows,
    list: async (userId, { cursor, limit }) =>
      rows
        .filter((row) => row.userId === userId)
        .sort(newest)
        .filter(
          (row) =>
            !cursor ||
            row.createdAt < cursor.createdAt ||
            (row.createdAt.getTime() === cursor.createdAt.getTime() && row.id < cursor.id),
        )
        .slice(0, limit),
    findById: async (userId, id) => {
      const row = owned(userId, id);
      return row && { ...row };
    },
    insert: async (userId, { title }) => {
      tick += 1_000;
      const row: TodoRow = {
        id: crypto.randomUUID(),
        userId,
        title,
        completed: false,
        createdAt: new Date(tick),
        updatedAt: new Date(tick),
      };
      rows.push(row);
      return row;
    },
    update: async (userId, id, patch) => {
      const row = owned(userId, id);
      if (!row) return undefined;
      if (patch.title !== undefined) row.title = patch.title;
      if (patch.completed !== undefined) row.completed = patch.completed;
      return { ...row };
    },
    remove: async (userId, id) => {
      const index = rows.findIndex((row) => row.userId === userId && row.id === id);
      if (index === -1) return false;
      rows.splice(index, 1);
      return true;
    },
  };
};

const setup = (overrides: Partial<TodoServiceDeps> = {}) => {
  const repo = memoryRepo();
  const notified: TodoCompletedJob[] = [];
  const service = createTodoService({
    repo,
    idempotency: createMemoryIdempotencyStore(),
    notifyCompleted: async (job) => {
      notified.push(job);
    },
    suggestTitles: null,
    todosUrl: "http://localhost:3000/",
    logger,
    ...overrides,
  });
  return { repo, service, notified };
};

const expectProblem = async (promise: Promise<unknown>, status: number) => {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ProblemError);
  expect((error as ProblemError).status).toBe(status);
};

describe("todo service: pagination", () => {
  it("should return pages newest first with a cursor until the last page", async () => {
    const { service } = setup();
    for (const title of ["a", "b", "c", "d", "e"]) await service.create(alice, { title });

    const first = await service.list(alice, { limit: 2 });
    const second = await service.list(alice, { limit: 2, cursor: first.nextCursor ?? "" });
    const third = await service.list(alice, { limit: 2, cursor: second.nextCursor ?? "" });

    expect(first.items.map((t) => t.title)).toEqual(["e", "d"]);
    expect(second.items.map((t) => t.title)).toEqual(["c", "b"]);
    expect(third.items.map((t) => t.title)).toEqual(["a"]);
    expect(third.nextCursor).toBeNull();
  });

  it("should reject the request when the cursor was not issued by the api", async () => {
    const { service } = setup();
    await expectProblem(service.list(alice, { limit: 2, cursor: "not-a-cursor" }), 400);
  });

  it("should round-trip a cursor when encoding and decoding it", () => {
    const cursor = { createdAt: new Date("2026-05-01T10:00:00.123Z"), id: crypto.randomUUID() };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });
});

describe("todo service: isolation", () => {
  it("should hide another user's todo as not found", async () => {
    const { service } = setup();
    const { todo } = await service.create(alice, { title: "secret" });

    await expectProblem(service.get(bob, todo.id), 404);
    await expectProblem(service.update(bob, todo.id, { completed: true }), 404);
    await expectProblem(service.remove(bob, todo.id), 404);
    expect((await service.list(bob, { limit: 10 })).items).toEqual([]);
  });
});

describe("todo service: idempotent create", () => {
  it("should return the original todo when the same key and body are retried", async () => {
    const { service, repo } = setup();

    const first = await service.create(alice, { title: "milk" }, "key-1");
    const retry = await service.create(alice, { title: "milk" }, "key-1");

    expect(retry).toEqual({ todo: first.todo, replayed: true });
    expect(repo.rows).toHaveLength(1);
  });

  it("should reject the request when a key is reused with a different body", async () => {
    const { service } = setup();
    await service.create(alice, { title: "milk" }, "key-1");

    await expectProblem(service.create(alice, { title: "eggs" }, "key-1"), 422);
  });

  it("should scope keys per user when two users send the same key", async () => {
    const { service, repo } = setup();
    await service.create(alice, { title: "milk" }, "shared");
    const bobs = await service.create(bob, { title: "milk" }, "shared");

    expect(bobs.replayed).toBe(false);
    expect(repo.rows).toHaveLength(2);
  });

  it("should release the key when the insert fails so the client can retry", async () => {
    const { service, repo } = setup();
    const insert = repo.insert;
    repo.insert = async () => {
      throw new Error("db down");
    };
    await expect(service.create(alice, { title: "milk" }, "key-1")).rejects.toThrow("db down");

    repo.insert = insert;
    const retried = await service.create(alice, { title: "milk" }, "key-1");
    expect(retried.replayed).toBe(false);
  });
});

describe("todo service: completion notification", () => {
  it("should notify once when a todo becomes completed", async () => {
    const { service, notified } = setup();
    const { todo } = await service.create(alice, { title: "milk" });

    await service.update(alice, todo.id, { completed: true });
    await service.update(alice, todo.id, { completed: true });
    await service.update(alice, todo.id, { title: "oat milk" });

    expect(notified).toEqual([
      {
        todoId: todo.id,
        userId: "alice",
        title: "milk",
        to: "alice@example.com",
        name: "Alice",
        url: "http://localhost:3000/",
      },
    ]);
  });

  it("should still succeed when enqueueing the notification fails", async () => {
    const { service } = setup({
      notifyCompleted: async () => {
        throw new Error("redis down");
      },
    });
    const { todo } = await service.create(alice, { title: "milk" });

    const updated = await service.update(alice, todo.id, { completed: true });

    expect(updated.completed).toBe(true);
    await vi.waitFor(() => expect(logger.error).toHaveBeenCalled());
  });
});

describe("todo service: suggestions", () => {
  it("should return 503 when AI is not configured", async () => {
    const { service } = setup();
    await expectProblem(service.suggest("buy milk"), 503);
  });

  it("should return 503 when the model call fails", async () => {
    const { service } = setup({
      suggestTitles: async () => {
        throw new Error("timeout");
      },
    });
    await expectProblem(service.suggest("buy milk"), 503);
  });

  it("should return titles when the model succeeds", async () => {
    const { service } = setup({ suggestTitles: async () => ["a", "b"] });
    expect(await service.suggest("a and b")).toEqual(["a", "b"]);
  });
});
