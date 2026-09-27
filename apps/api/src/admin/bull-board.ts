import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Queue } from "bullmq";

/** Where the dashboard is served (outside the `/api` prefix). 面板路径（不在 `/api` 前缀下）。 */
export const BULL_BOARD_PATH = "/admin/queues";

/**
 * Serves Bull Board, a UI to inspect, retry and clean jobs. It has no authentication and
 * is a devDependency, so main.ts imports this module in development only; never expose
 * it in production.
 *
 * 挂载 Bull Board：用于查看、重试和清理任务的界面。它没有鉴权，且属于 devDependencies，
 * 因此 main.ts 只在开发环境动态导入本模块；绝不能在生产环境暴露。
 *
 * @param app - The api app, before `listen()`. 调用 `listen()` 之前的 api 应用。
 * @param queues - Queues to show. 要展示的队列。
 */
export const mountBullBoard = (app: NestExpressApplication, queues: Queue[]) => {
  const serverAdapter = new ExpressAdapter().setBasePath(BULL_BOARD_PATH);
  createBullBoard({ queues: queues.map((queue) => new BullMQAdapter(queue)), serverAdapter });
  app.use(BULL_BOARD_PATH, serverAdapter.getRouter());
};
