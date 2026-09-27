/*
 * Bull Board mounting on a real Nest/Express app. The queues use lazy Redis connections
 * that are never opened, because serving the dashboard page does not read any jobs.
 *
 * 在真实的 Nest/Express 应用上挂载 Bull Board。队列使用惰性 Redis 连接且不会真正连接，
 * 因为返回面板页面不需要读取任务。
 */
import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import { Queue } from "bullmq";
import { afterEach, describe, expect, it } from "vitest";
import { BULL_BOARD_PATH, mountBullBoard } from "./bull-board.js";

let app: INestApplication | undefined;
const queues: Queue[] = [];

afterEach(async () => {
  await app?.close();
  await Promise.all(queues.splice(0).map((queue) => queue.close()));
});

const lazyQueue = (name: string) => {
  const queue = new Queue(name, { connection: { host: "127.0.0.1", port: 1, lazyConnect: true } });
  queues.push(queue);
  return queue;
};

describe("mountBullBoard", () => {
  it("should serve the dashboard under /admin/queues", async () => {
    const moduleRef = await Test.createTestingModule({}).compile();
    const nest = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    app = nest;
    mountBullBoard(nest, [lazyQueue("email"), lazyQueue("notifications")]);
    await nest.listen(0, "127.0.0.1");

    const response = await fetch(`${await nest.getUrl()}${BULL_BOARD_PATH}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
  });
});
