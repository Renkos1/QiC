/** Resolves when a dependency is reachable; rejects otherwise. 依赖可达时 resolve，否则 reject。 */
export type ReadinessCheck = () => Promise<void>;

/** Body of `/readyz`. `/readyz` 的响应体。 */
export interface ReadinessReport {
  status: "ok" | "unavailable";
  checks: Record<string, "ok" | "unavailable">;
}

const withTimeout = (check: ReadinessCheck, ms: number) =>
  Promise.race([
    check(),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms).unref();
    }),
  ]);

/**
 * Runs every check in parallel; one failure or timeout makes the instance unavailable.
 *
 * 并行执行所有检查；任一失败或超时即判定实例不可用。
 *
 * @param checks - Named checks. 具名检查函数。
 * @param timeoutMs - Per-check limit. 单项检查的超时。
 */
export const checkReadiness = async (
  checks: Record<string, ReadinessCheck>,
  timeoutMs = 2_000,
): Promise<ReadinessReport> => {
  const entries = await Promise.all(
    Object.entries(checks).map(async ([name, check]) => {
      try {
        await withTimeout(check, timeoutMs);
        return [name, "ok"] as const;
      } catch {
        return [name, "unavailable"] as const;
      }
    }),
  );
  return {
    status: entries.every(([, state]) => state === "ok") ? "ok" : "unavailable",
    checks: Object.fromEntries(entries),
  };
};
