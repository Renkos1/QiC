import { Module } from "@nestjs/common";
import { SystemController } from "./system.controller.js";

/**
 * System feature module.
 *
 * 系统功能模块。
 */
@Module({ controllers: [SystemController] })
export class SystemModule {}
