import type { ServerResponse } from "node:http";
import { Controller, Get, Inject, Res } from "@nestjs/common";
import { APP_CONFIG, type AppConfig, READINESS_CHECKS } from "../tokens.js";
import { checkReadiness, type ReadinessCheck } from "./readiness.js";

/**
 * Liveness (/healthz): the process is up; never touches dependencies, so a DB outage
 * does not make the orchestrator restart healthy containers.
 * Readiness (/readyz): every dependency answers; 503 takes the instance out of rotation.
 * Both sit outside the /api prefix and are not routed by Caddy.
 *
 * 存活检查（/healthz）：进程在运行即可，不访问依赖，避免数据库故障导致编排器重启健康的容器。
 * 就绪检查（/readyz）：所有依赖都可达；返回 503 时实例被移出流量。两者都不在 `/api` 下，Caddy 不对外转发。
 */
@Controller()
export class HealthController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    /** Dependencies that must be reachable to serve traffic (AGENTS.md §12). 对外服务前必须可达的依赖。 */
    @Inject(READINESS_CHECKS) private readonly checks: Record<string, ReadinessCheck>,
  ) {}

  /** Liveness: always 200 with the build sha. 存活检查：总是返回 200 和构建标识。 */
  @Get("healthz")
  liveness() {
    return { status: "ok", sha: this.config.gitSha };
  }

  /** Readiness: 200 when every dependency answers, else 503. 就绪检查：依赖全部可达返回 200，否则 503。 */
  @Get("readyz")
  async readiness(@Res({ passthrough: true }) response: ServerResponse) {
    const report = await checkReadiness(this.checks);
    if (report.status !== "ok") response.statusCode = 503;
    return report;
  }
}
