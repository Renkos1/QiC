/*
 * Worker /healthz over real HTTP via a Nest testing module.
 *
 * worker 的 /healthz，通过 Nest 测试模块经真实 HTTP 调用。
 */
import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterEach, describe, expect, it } from "vitest";
import { HealthController } from "./health.controller.js";
import { WORKER_HEALTH } from "./tokens.js";

let app: INestApplication | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

const start = async (isHealthy: () => boolean) => {
  const moduleRef = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [{ provide: WORKER_HEALTH, useValue: isHealthy }],
  }).compile();
  app = moduleRef.createNestApplication({ logger: false });
  await app.listen(0, "127.0.0.1");
  return app.getUrl();
};

describe("worker health endpoint", () => {
  it("should return 200 when the worker is healthy", async () => {
    const url = await start(() => true);
    const response = await fetch(`${url}/healthz`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("should return 503 when the worker is not healthy", async () => {
    const url = await start(() => false);
    expect((await fetch(`${url}/healthz`)).status).toBe(503);
  });

  it("should return 404 for any other path", async () => {
    const url = await start(() => true);
    expect((await fetch(`${url}/metrics`)).status).toBe(404);
  });
});
