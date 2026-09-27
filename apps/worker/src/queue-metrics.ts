import { getQueueToken } from "@nestjs/bullmq";
import { Inject, type OnApplicationBootstrap, type OnModuleDestroy } from "@nestjs/common";
import { DEAD_LETTER_QUEUE, EMAIL_QUEUE, NOTIFICATIONS_QUEUE } from "@qic/contracts";
import { observeQueueBacklog } from "@qic/telemetry";
import type { Queue } from "bullmq";

/**
 * Publishes the backlog of every queue the worker knows (including dead letters) as the
 * `qic.queue.jobs` gauge; the queue-backlog alert and runbook are built on it.
 *
 * 把 worker 管理的所有队列（包括死信队列）的积压量发布为 `qic.queue.jobs` 指标；
 * 队列积压告警和对应 runbook 都基于它。
 */
export class QueueMetrics implements OnApplicationBootstrap, OnModuleDestroy {
  private stop: (() => void) | undefined;
  private readonly queues: Queue[];

  constructor(
    @Inject(getQueueToken(EMAIL_QUEUE)) email: Queue,
    @Inject(getQueueToken(NOTIFICATIONS_QUEUE)) notifications: Queue,
    @Inject(getQueueToken(DEAD_LETTER_QUEUE)) deadLetters: Queue,
  ) {
    this.queues = [email, notifications, deadLetters];
  }

  /** Starts observing once the queues are connected. 队列连接后开始观测。 */
  onApplicationBootstrap() {
    this.stop = observeQueueBacklog(this.queues);
  }

  /** Stops observing before the queues close. 队列关闭前停止观测。 */
  onModuleDestroy() {
    this.stop?.();
  }
}
