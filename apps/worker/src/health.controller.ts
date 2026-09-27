import type { ServerResponse } from "node:http";
import { Controller, Get, Inject, Res } from "@nestjs/common";
import { WORKER_HEALTH } from "./tokens.js";

/**
 * Liveness endpoint for container health checks; the worker has no other HTTP surface.
 * 200 while every queue consumer is running, 503 otherwise.
 *
 * 容器健康检查用的存活接口；worker 没有其他 HTTP 接口。所有队列消费者都在运行时返回 200，否则 503。
 */
@Controller()
export class HealthController {
  constructor(@Inject(WORKER_HEALTH) private readonly isHealthy: () => boolean) {}

  /** `GET /healthz`. 健康检查。 */
  @Get("healthz")
  healthz(@Res({ passthrough: true }) response: ServerResponse) {
    const healthy = this.isHealthy();
    if (!healthy) response.statusCode = 503;
    return { status: healthy ? "ok" : "unavailable" };
  }
}
