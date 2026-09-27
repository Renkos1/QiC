import { Module } from "@nestjs/common";
import { type LanguageModel, splitIntoTodos } from "@qic/ai";
import type { TodoCompletedJob } from "@qic/contracts";
import type { DbHandle } from "@qic/db";
import type { Logger } from "@qic/logger";
import type { Redis } from "ioredis";
import { createRedisIdempotencyStore } from "../../lib/idempotency.js";
import {
  APP_CONFIG,
  type AppConfig,
  DATABASE,
  LANGUAGE_MODEL,
  LOGGER,
  NOTIFY_TODO_COMPLETED,
  REDIS,
  TODO_SERVICE,
} from "../../tokens.js";
import { createTodoRepo } from "./repo.js";
import { createTodoService } from "./service.js";
import { TodosController } from "./todos.controller.js";

/**
 * Todos feature module: wires the framework-free service to its controller.
 *
 * 待办功能模块：把不依赖框架的服务装配到控制器上。
 */
@Module({
  controllers: [TodosController],
  providers: [
    {
      provide: TODO_SERVICE,
      inject: [DATABASE, REDIS, LANGUAGE_MODEL, APP_CONFIG, NOTIFY_TODO_COMPLETED, LOGGER],
      useFactory: (
        database: DbHandle,
        redis: Redis,
        model: LanguageModel | null,
        config: AppConfig,
        notifyCompleted: (job: TodoCompletedJob) => Promise<void>,
        logger: Logger,
      ) =>
        createTodoService({
          repo: createTodoRepo(database.db),
          idempotency: createRedisIdempotencyStore(redis),
          notifyCompleted,
          suggestTitles: model
            ? async (text) => (await splitIntoTodos(model, text, logger)).output.todos
            : null,
          todosUrl: new URL("/examples/todos", config.publicWebUrl).toString(),
          logger,
        }),
    },
  ],
})
export class TodosModule {}
