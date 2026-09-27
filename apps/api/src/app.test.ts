/*
 * The api HTTP pipeline (configureHttpApp) around a probe controller: request ids, auth
 * guard, contract validation, RFC 9457 errors, error reporting, rate limits and health
 * routes. Better Auth and the error reporter are fakes; no database or Redis.
 *
 * api 的 HTTP 管道测试（configureHttpApp + 探针控制器）：请求 id、鉴权守卫、契约校验、
 * RFC 9457 错误格式、错误上报、限流与健康检查。Better Auth 与错误上报器为假实现，
 * 不需要数据库和 Redis。
 */
import "reflect-metadata";
import { Controller, Get, type INestApplication, UseGuards } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import { defineRoute, PROBLEM_CONTENT_TYPE } from "@qic/contracts";
import type { Logger } from "@qic/logger";
import { type ErrorReporter, NOOP_ERROR_REPORTER } from "@qic/telemetry";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { Actor } from "./auth/actor.js";
import type { AuthSession } from "./auth/auth.js";
import { type AuthRuntime, CurrentActor, SessionGuard } from "./auth/session.guard.js";
import { HealthController } from "./health/health.controller.js";
import type { ReadinessCheck } from "./health/readiness.js";
import { ContractBody, ContractRoute } from "./http/contract.js";
import { RateLimit } from "./http/rate-limit.js";
import { configureHttpApp, HTTP_APP_OPTIONS } from "./http-app.js";
import { createMemoryRateLimiter, type RateLimiter } from "./lib/rate-limiter.js";
import { APP_CONFIG, AUTH, RATE_LIMITER, READINESS_CHECKS } from "./tokens.js";

const logger = {
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  child: () => logger,
} as unknown as Logger;

const authHandler = vi.fn(async () => new Response("auth"));
const signedIn: AuthRuntime = {
  handler: authHandler,
  api: {
    getSession: async () =>
      ({
        user: { id: "u1", name: "A", email: "a@example.com" },
        session: { id: "s1" },
      }) as unknown as AuthSession,
  },
};
const anonymous: AuthRuntime = { handler: authHandler, api: { getSession: async () => null } };

const echoRoute = defineRoute({
  method: "post",
  path: "/echo",
  request: {
    body: { content: { "application/json": { schema: z.object({ title: z.string().min(1) }) } } },
  },
  responses: { 200: { description: "ok" } },
});

@Controller()
class ProbeController {
  @Get("private")
  @UseGuards(SessionGuard)
  private(@CurrentActor() actor: Actor) {
    return { userId: actor.id };
  }

  @Get("limited")
  @RateLimit({ name: "probe", max: 2, window: 60, by: "ip" })
  limited() {
    return { ok: true };
  }

  // Decorators apply bottom-up: SessionGuard must be listed below RateLimit to run first.
  @Get("limited-per-user")
  @RateLimit({ name: "probe-user", max: 1, window: 60, by: "user" })
  @UseGuards(SessionGuard)
  limitedPerUser() {
    return { ok: true };
  }

  @Get("boom")
  boom() {
    throw new Error("db password is hunter2");
  }

  @ContractRoute(echoRoute)
  echo(@ContractBody(echoRoute) body: { title: string }) {
    return body;
  }
}

let app: INestApplication | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

/** Starts the real HTTP pipeline (configureHttpApp) around a probe controller. */
const start = async (
  auth: AuthRuntime,
  checks: Record<string, ReadinessCheck> = {},
  rateLimiter: RateLimiter | null = null,
  errors: ErrorReporter = NOOP_ERROR_REPORTER,
) => {
  const moduleRef = await Test.createTestingModule({
    controllers: [ProbeController, HealthController],
    providers: [
      { provide: AUTH, useValue: auth },
      { provide: APP_CONFIG, useValue: { gitSha: "abc123" } },
      { provide: READINESS_CHECKS, useValue: checks },
      { provide: RATE_LIMITER, useValue: rateLimiter },
    ],
  }).compile();
  const nest = moduleRef.createNestApplication<NestExpressApplication>({
    ...HTTP_APP_OPTIONS,
    logger: false,
  });
  app = configureHttpApp(nest, logger, errors);
  await nest.listen(0, "127.0.0.1");
  const base = await nest.getUrl();
  return (path: string, init?: RequestInit) => fetch(`${base}${path}`, init);
};

describe("http pipeline", () => {
  it("should return 401 problem+json when a protected route is called without a session", async () => {
    const res = await (await start(anonymous))("/api/private");
    expect(res.status).toBe(401);
    expect(res.headers.get("content-type")).toBe(PROBLEM_CONTENT_TYPE);
    expect(await res.json()).toMatchObject({ status: 401, title: "Unauthorized" });
  });

  it("should expose the user when a protected route is called with a session", async () => {
    const res = await (await start(signedIn))("/api/private");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userId: "u1" });
  });

  it("should delegate to Better Auth when the path is under /api/auth", async () => {
    const res = await (await start(anonymous))("/api/auth/get-session");
    expect(await res.text()).toBe("auth");
    expect(authHandler).toHaveBeenCalledOnce();
  });

  it("should return 404 problem+json when the route does not exist", async () => {
    const res = await (await start(anonymous))("/api/nope");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toBe(PROBLEM_CONTENT_TYPE);
  });

  it("should return 400 with field errors when the body fails validation", async () => {
    const res = await (await start(anonymous))("/api/echo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "" }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { errors: unknown };
    expect(body.errors).toEqual([expect.objectContaining({ path: "title" })]);
  });

  it("should return 400 problem+json when the body is not valid JSON", async () => {
    const res = await (await start(anonymous))("/api/echo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toBe(PROBLEM_CONTENT_TYPE);
  });

  it("should hide internal details and include the request id when an unexpected error is thrown", async () => {
    const res = await (await start(anonymous))("/api/boom", {
      headers: { "x-request-id": "req-42" },
    });
    expect(res.status).toBe(500);
    expect(res.headers.get("x-request-id")).toBe("req-42");
    const text = await res.text();
    expect(text).not.toContain("hunter2");
    expect(JSON.parse(text)).toMatchObject({ traceId: "req-42" });
  });

  it("should generate a request id when the inbound one is unsafe", async () => {
    const res = await (await start(anonymous))("/api/private", {
      headers: { "x-request-id": "bad id with spaces" },
    });
    expect(res.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("should not advertise the framework", async () => {
    const res = await (await start(anonymous))("/healthz");
    expect(res.headers.get("x-powered-by")).toBeNull();
  });
});

describe("error reporting", () => {
  const reporter = () => ({ enabled: true, capture: vi.fn(), flush: vi.fn(async () => {}) });

  it("should report an unexpected error with the route but not the response body", async () => {
    const errors = reporter();
    const request = await start(anonymous, {}, null, errors);
    await request("/api/boom");
    expect(errors.capture).toHaveBeenCalledWith(expect.any(Error), {
      method: "GET",
      path: "/api/boom",
    });
  });

  it("should not report expected client errors", async () => {
    const errors = reporter();
    const request = await start(anonymous, {}, null, errors);
    await request("/api/private");
    await request("/api/nope");
    expect(errors.capture).not.toHaveBeenCalled();
  });
});

describe("rate limiting", () => {
  it("should answer 429 problem+json with Retry-After once the budget is spent", async () => {
    const request = await start(anonymous, {}, createMemoryRateLimiter());
    expect((await request("/api/limited")).status).toBe(200);
    expect((await request("/api/limited")).status).toBe(200);
    const blocked = await request("/api/limited");
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("content-type")).toBe(PROBLEM_CONTENT_TYPE);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await blocked.json()).toMatchObject({ status: 429, title: "Too Many Requests" });
  });

  it("should not let a client pick its own bucket with a multi-hop X-Forwarded-For", async () => {
    const request = await start(anonymous, {}, createMemoryRateLimiter());
    const spoofed = (ip: string) =>
      request("/api/limited", { headers: { "x-forwarded-for": `${ip}, 10.0.0.1` } });
    await spoofed("1.1.1.1");
    await spoofed("2.2.2.2");
    expect((await spoofed("3.3.3.3")).status).toBe(429);
  });

  it("should count per signed-in user when the policy is by user", async () => {
    const request = await start(signedIn, {}, createMemoryRateLimiter());
    expect((await request("/api/limited-per-user")).status).toBe(200);
    expect((await request("/api/limited-per-user")).status).toBe(429);
  });

  it("should not limit anything when rate limiting is disabled", async () => {
    const request = await start(anonymous);
    for (let i = 0; i < 4; i += 1) expect((await request("/api/limited")).status).toBe(200);
  });
});

describe("health routes", () => {
  it("should report the git sha when /healthz is called", async () => {
    const res = await (await start(anonymous))("/healthz");
    expect(await res.json()).toEqual({ status: "ok", sha: "abc123" });
  });

  it("should return 503 when a readiness check fails", async () => {
    const request = await start(anonymous, {
      database: async () => {},
      redis: async () => {
        throw new Error("ECONNREFUSED");
      },
    });
    const res = await request("/readyz");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      status: "unavailable",
      checks: { database: "ok", redis: "unavailable" },
    });
  });

  it("should return 200 when every readiness check passes", async () => {
    const res = await (await start(anonymous, { database: async () => {} }))("/readyz");
    expect(res.status).toBe(200);
  });

  it("should not serve health checks under /api", async () => {
    const res = await (await start(anonymous))("/api/healthz");
    expect(res.status).toBe(404);
  });
});
