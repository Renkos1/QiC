/*
 * The real AppModule over HTTP against Postgres and Redis containers: sign-up and
 * verification, password reset, per-user isolation, idempotency, paging, notifications.
 * Outgoing email and notifications are recorded instead of queued. Requires Docker.
 *
 * 真实 AppModule 经 HTTP 对接 Postgres 与 Redis 容器的集成测试：注册验证、重置密码、用户隔离、
 * 幂等、分页、通知。邮件和通知只记录不投递。需要 Docker。
 */
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { SendEmailJob, Todo, TodoCompletedJob, TodoPage } from "@qic/contracts";
import { todos, users } from "@qic/db";
import { startTestDatabase, type TestDatabase, truncateAll } from "@qic/db/testing";
import type { Logger } from "@qic/logger";
import { RedisContainer, type StartedRedisContainer } from "@testcontainers/redis";
import { eq } from "drizzle-orm";
import { Redis } from "ioredis";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "./app.module.js";
import { configureHttpApp, HTTP_APP_OPTIONS } from "./http-app.js";
import { createRedisRateLimiter, type RateLimiter } from "./lib/rate-limiter.js";

const WEB = "http://localhost:3000";
const logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: () => logger,
} as unknown as Logger;

let database: TestDatabase;
let redisContainer: StartedRedisContainer;
let redis: Redis;
let app: NestExpressApplication;
let base: string;

// Every request goes over real HTTP to the listening app.
const httpRequest = (path: string, init?: RequestInit) => fetch(`${base}${path}`, init);
const emails: SendEmailJob[] = [];
const notifications: TodoCompletedJob[] = [];

/** Starts the real app on a free port; `rateLimiter` null disables limiting. */
const startApp = async (rateLimiter: RateLimiter | null) => {
  const nest = await NestFactory.create<NestExpressApplication>(
    AppModule.forRoot({
      database,
      redis,
      logger,
      config: {
        publicWebUrl: WEB,
        authSecret: "integration-test-secret-0123456789abcdef",
        gitSha: "test",
      },
      model: null,
      sendEmail: async (job) => {
        emails.push(job);
      },
      notifyTodoCompleted: async (job) => {
        notifications.push(job);
      },
      rateLimiter,
    }),
    { ...HTTP_APP_OPTIONS, logger: false },
  );
  configureHttpApp(nest, logger);
  await nest.listen(0, "127.0.0.1");
  return nest;
};

beforeAll(async () => {
  [database, redisContainer] = await Promise.all([
    startTestDatabase(),
    new RedisContainer("redis:8.8.3-alpine").start(),
  ]);
  redis = new Redis(redisContainer.getConnectionUrl());
  // Most tests sign up several users from one IP, so limiting is off by default here.
  app = await startApp(null);
  base = await app.getUrl();
});

afterAll(async () => {
  await app?.close();
  redis?.disconnect();
  await Promise.all([database?.stop(), redisContainer?.stop()]);
});

beforeEach(async () => {
  await truncateAll(database);
  await redis.flushdb();
  emails.length = 0;
  notifications.length = 0;
});

/** Minimal cookie jar: keeps name=value pairs from Set-Cookie across requests. */
const cookieJar = () => {
  const cookies = new Map<string, string>();
  return {
    store: (response: Response) => {
      for (const header of response.headers.getSetCookie()) {
        const [pair] = header.split(";");
        const [name, ...value] = (pair ?? "").split("=");
        if (name) cookies.set(name.trim(), value.join("="));
      }
    },
    header: () => [...cookies].map(([name, value]) => `${name}=${value}`).join("; "),
  };
};

type Client = ReturnType<typeof clientFor>;

const clientFor = (jar: ReturnType<typeof cookieJar>) => {
  const request = async (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    headers.set("origin", WEB);
    headers.set("cookie", jar.header());
    if (init.body) headers.set("content-type", "application/json");
    const response = await httpRequest(path, { ...init, headers, redirect: "manual" });
    jar.store(response);
    return response;
  };
  return {
    request,
    json: async <T>(path: string, init?: RequestInit) => {
      const response = await request(path, init);
      return {
        status: response.status,
        headers: response.headers,
        body: (await response.json()) as T,
      };
    },
  };
};

/** Signs up, follows the emailed verification link, and returns a signed-in client. */
const signUpVerified = async (name: string, email: string): Promise<Client> => {
  const client = clientFor(cookieJar());
  const signUp = await client.request("/api/auth/sign-up/email", {
    method: "POST",
    body: JSON.stringify({ name, email, password: "password-123", callbackURL: "/" }),
  });
  expect(signUp.status).toBe(200);

  const verification = emails.find((job) => job.to === email && job.template === "verify-email");
  expect(verification).toBeDefined();
  const link = new URL(verification?.url ?? "");
  expect(link.origin).toBe(WEB);

  const verify = await client.request(`${link.pathname}${link.search}`);
  expect(verify.status).toBe(302);
  return client;
};

describe("auth", () => {
  it("should reject sign-in when the email is not verified", async () => {
    const client = clientFor(cookieJar());
    await client.request("/api/auth/sign-up/email", {
      method: "POST",
      body: JSON.stringify({ name: "U", email: "u@example.com", password: "password-123" }),
    });

    const signIn = await client.request("/api/auth/sign-in/email", {
      method: "POST",
      body: JSON.stringify({ email: "u@example.com", password: "password-123" }),
    });

    expect(signIn.status).toBe(403);
  });

  it("should mark the user verified and sign them in when the email link is opened", async () => {
    const client = await signUpVerified("Alice", "alice@example.com");

    const [user] = await database.db
      .select()
      .from(users)
      .where(eq(users.email, "alice@example.com"));
    expect(user?.emailVerified).toBe(true);
    expect((await client.request("/api/todos")).status).toBe(200);
  });

  it("should reset the password from the emailed link and revoke existing sessions", async () => {
    const signedIn = await signUpVerified("Alice", "alice@example.com");
    const anonymous = clientFor(cookieJar());

    const requested = await anonymous.request("/api/auth/request-password-reset", {
      method: "POST",
      body: JSON.stringify({ email: "alice@example.com", redirectTo: "/reset-password" }),
    });
    expect(requested.status).toBe(200);
    const resetEmail = emails.find((job) => job.template === "reset-password");
    const link = new URL(resetEmail?.url ?? "");
    expect(link.origin).toBe(WEB);

    // The emailed link validates the token and redirects to the web page with it.
    const opened = await anonymous.request(`${link.pathname}${link.search}`);
    expect(opened.status).toBe(302);
    const token = new URL(opened.headers.get("location") ?? "", WEB).searchParams.get("token");
    expect(token).toBeTruthy();

    const reset = await anonymous.request("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ newPassword: "new-password-456", token }),
    });
    expect(reset.status).toBe(200);

    const signIn = (password: string) =>
      clientFor(cookieJar()).request("/api/auth/sign-in/email", {
        method: "POST",
        body: JSON.stringify({ email: "alice@example.com", password }),
      });
    expect((await signIn("password-123")).status).toBe(401);
    expect((await signIn("new-password-456")).status).toBe(200);
    expect((await signedIn.request("/api/todos")).status).toBe(401);
  });

  it("should accept a reset request for an unknown email without revealing it", async () => {
    const response = await clientFor(cookieJar()).request("/api/auth/request-password-reset", {
      method: "POST",
      body: JSON.stringify({ email: "nobody@example.com", redirectTo: "/reset-password" }),
    });
    expect(response.status).toBe(200);
    expect(emails.filter((job) => job.template === "reset-password")).toHaveLength(0);
  });
});

describe("todos over HTTP", () => {
  it("should isolate todos between users", async () => {
    const alice = await signUpVerified("Alice", "alice@example.com");
    const bob = await signUpVerified("Bob", "bob@example.com");
    const { body: todo } = await alice.json<Todo>("/api/todos", {
      method: "POST",
      body: JSON.stringify({ title: "alice only" }),
    });

    expect((await bob.request(`/api/todos/${todo.id}`)).status).toBe(404);
    expect(
      (
        await bob.request(`/api/todos/${todo.id}`, {
          method: "PATCH",
          body: JSON.stringify({ completed: true }),
        })
      ).status,
    ).toBe(404);
    expect((await bob.request(`/api/todos/${todo.id}`, { method: "DELETE" })).status).toBe(404);
    expect((await bob.json<TodoPage>("/api/todos")).body.items).toEqual([]);
    expect((await alice.json<TodoPage>("/api/todos")).body.items.map((t) => t.id)).toEqual([
      todo.id,
    ]);
  });

  it("should create one todo when a request is retried with the same Idempotency-Key", async () => {
    const alice = await signUpVerified("Alice", "alice@example.com");
    const send = () =>
      alice.json<Todo>("/api/todos", {
        method: "POST",
        headers: { "idempotency-key": "retry-1" },
        body: JSON.stringify({ title: "milk" }),
      });

    const first = await send();
    const retry = await send();

    expect(first.status).toBe(201);
    expect(retry.status).toBe(201);
    expect(retry.headers.get("idempotent-replayed")).toBe("true");
    expect(retry.body.id).toBe(first.body.id);
    expect(await database.db.select().from(todos)).toHaveLength(1);
  });

  it("should page through todos that share a timestamp without gaps or repeats", async () => {
    const alice = await signUpVerified("Alice", "alice@example.com");
    const [owner] = await database.db
      .select()
      .from(users)
      .where(eq(users.email, "alice@example.com"));
    const sameInstant = new Date("2026-01-01T00:00:00.000Z");
    await database.db.insert(todos).values(
      Array.from({ length: 7 }, (_, index) => ({
        userId: owner?.id ?? "",
        title: `t${index}`,
        createdAt: sameInstant,
      })),
    );

    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const query: string = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
      const { body } = await alice.json<TodoPage>(`/api/todos?limit=3${query}`);
      seen.push(...body.items.map((todo) => todo.id));
      cursor = body.nextCursor;
    } while (cursor);

    expect(seen).toHaveLength(7);
    expect(new Set(seen).size).toBe(7);
  });

  it("should enqueue one notification when a todo is completed", async () => {
    const alice = await signUpVerified("Alice", "alice@example.com");
    const { body: todo } = await alice.json<Todo>("/api/todos", {
      method: "POST",
      body: JSON.stringify({ title: "milk" }),
    });

    await alice.request(`/api/todos/${todo.id}`, {
      method: "PATCH",
      body: JSON.stringify({ completed: true }),
    });
    await alice.request(`/api/todos/${todo.id}`, {
      method: "PATCH",
      body: JSON.stringify({ completed: true }),
    });

    await vi.waitFor(() => expect(notifications).toHaveLength(1));
    expect(notifications[0]).toMatchObject({ todoId: todo.id, to: "alice@example.com" });
  });

  it("should report ready when the database and redis are reachable", async () => {
    const response = await httpRequest("/readyz");
    expect(response.status).toBe(200);
  });
});

describe("rate limiting", () => {
  let limitedApp: NestExpressApplication;
  let unlimitedBase: string;

  beforeAll(async () => {
    limitedApp = await startApp(createRedisRateLimiter(redis));
    unlimitedBase = base;
    base = await limitedApp.getUrl();
  });

  afterAll(async () => {
    base = unlimitedBase;
    await limitedApp?.close();
  });

  it("should block the fourth sign-in attempt within ten seconds from one IP", async () => {
    const attempt = () =>
      clientFor(cookieJar()).request("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "x-forwarded-for": "198.51.100.1" },
        body: JSON.stringify({ email: "nobody@example.com", password: "wrong-password" }),
      });
    const statuses = [];
    for (let i = 0; i < 4; i += 1) statuses.push((await attempt()).status);
    expect(statuses).toEqual([401, 401, 401, 429]);
  });

  it("should count sign-in attempts per client IP", async () => {
    const attempt = (ip: string) =>
      clientFor(cookieJar()).request("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "x-forwarded-for": ip },
        body: JSON.stringify({ email: "nobody@example.com", password: "wrong-password" }),
      });
    for (let i = 0; i < 3; i += 1) await attempt("198.51.100.2");
    expect((await attempt("198.51.100.3")).status).toBe(401);
  });

  it("should cap AI calls per user and answer 429 with Retry-After", async () => {
    // Created through the unlimited app so sign-up limits do not interfere.
    base = unlimitedBase;
    const alice = await signUpVerified("Alice", "alice@example.com");
    base = await limitedApp.getUrl();
    const suggest = () =>
      alice.request("/api/todos/suggestions", {
        method: "POST",
        body: JSON.stringify({ text: "buy milk and eggs" }),
      });
    // AI is not configured in tests, so allowed calls answer 503; the 11th is limited first.
    for (let i = 0; i < 10; i += 1) expect((await suggest()).status).toBe(503);
    const limited = await suggest();
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  });
});
