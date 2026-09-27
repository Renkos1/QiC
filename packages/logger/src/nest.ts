import type { Logger } from "pino";

type LogMethod = (message: unknown, ...params: unknown[]) => void;

/**
 * Structurally matches Nest's `LoggerService`, so this package does not depend on Nest.
 *
 * 与 Nest 的 `LoggerService` 结构兼容，因此本包无需依赖 Nest。
 */
export interface NestLoggerAdapter {
  log: LogMethod;
  error: LogMethod;
  warn: LogMethod;
  debug: LogMethod;
  verbose: LogMethod;
  fatal: LogMethod;
}

/** Nest passes the logging context (class name) as the last string argument. */
const contextOf = (params: unknown[]) => {
  const last = params.at(-1);
  return typeof last === "string" ? last : undefined;
};

/**
 * Routes Nest's framework logs into pino. Bootstrap chatter ("Mapped {/api/todos, GET}")
 * is debug; warnings and errors keep their level.
 *
 * 把 Nest 框架日志转到 pino：启动过程的信息（如路由映射）降为 debug，warn/error 保持原级别。
 *
 * @param logger - Target pino logger. 目标 pino 日志器。
 * @example NestFactory.create(AppModule, { logger: createNestLogger(logger) })
 */
export const createNestLogger = (logger: Logger): NestLoggerAdapter => ({
  log: (message, ...params) => logger.debug({ context: contextOf(params) }, String(message)),
  debug: (message, ...params) => logger.debug({ context: contextOf(params) }, String(message)),
  verbose: (message, ...params) => logger.trace({ context: contextOf(params) }, String(message)),
  warn: (message, ...params) => logger.warn({ context: contextOf(params) }, String(message)),
  error: (message, ...params) => {
    // Nest calls error(message, stack?, context?).
    const stack = params.length > 1 ? params[0] : undefined;
    logger.error({ context: contextOf(params), stack }, String(message));
  },
  fatal: (message, ...params) => logger.fatal({ context: contextOf(params) }, String(message)),
});
