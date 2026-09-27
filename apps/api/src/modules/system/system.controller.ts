import { Controller, Inject, UseGuards } from "@nestjs/common";
import type { LanguageModel } from "@qic/ai";
import { type Capabilities, getCapabilitiesRoute } from "@qic/contracts";
import { SessionGuard } from "../../auth/session.guard.js";
import { ContractRoute } from "../../http/contract.js";
import { LANGUAGE_MODEL } from "../../tokens.js";

/**
 * System endpoints for signed-in users.
 *
 * 面向已登录用户的系统接口。
 */
@Controller()
@UseGuards(SessionGuard)
export class SystemController {
  constructor(@Inject(LANGUAGE_MODEL) private readonly model: LanguageModel | null) {}

  /** `GET /api/capabilities`. 返回当前部署的可选功能。 */
  @ContractRoute(getCapabilitiesRoute)
  capabilities(): Capabilities {
    return { ai: this.model !== null };
  }
}
