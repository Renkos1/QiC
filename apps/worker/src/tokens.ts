/*
 * Injection tokens. Providers are always injected with `@Inject(TOKEN)` rather than by
 * class type, so the build needs no `emitDecoratorMetadata`.
 *
 * 依赖注入令牌。所有依赖都用 `@Inject(TOKEN)` 显式注入，因此不需要 `emitDecoratorMetadata`。
 */
/** Root pino logger. 根日志器。 */
export const LOGGER = Symbol("LOGGER");
/** SMTP mailer (`Mailer`). SMTP 发信器。 */
export const MAILER = Symbol("MAILER");
/** Runtime settings ({@link WorkerConfig}). 运行时配置。 */
export const WORKER_CONFIG = Symbol("WORKER_CONFIG");
/** Dead-letter sink (`DeadLetterSink`). 死信记录器。 */
export const DEAD_LETTERS = Symbol("DEAD_LETTERS");
/** `() => boolean`: every queue consumer is connected and processing. 所有队列消费者都在运行。 */
export const WORKER_HEALTH = Symbol("WORKER_HEALTH");

/** Settings resolved from the environment. 从环境变量解析的配置。 */
export interface WorkerConfig {
  /** Jobs processed in parallel per queue. 每个队列的并发任务数。 */
  concurrency: number;
}
