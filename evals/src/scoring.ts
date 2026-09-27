import { z } from "zod";

/**
 * One line of `datasets/split-todos.jsonl`: an input note and what a good answer must satisfy.
 *
 * `datasets/split-todos.jsonl` 中的一行：输入文本，以及合格答案必须满足的条件。
 */
export const EvalCaseSchema = z.object({
  id: z.string().min(1),
  input: z.string().min(1),
  expect: z.object({
    /** Fewest acceptable todos. 至少应拆出的条数。 */
    minItems: z.number().int().min(0),
    /** Most acceptable todos. 最多允许的条数。 */
    maxItems: z.number().int().min(1),
    /** Each group is one expected task; it is covered if any item contains any keyword. 每组对应一个应出现的任务，任一条目包含任一关键词即算覆盖。 */
    mustCover: z.array(z.array(z.string().min(1)).min(1)),
    /** Text that must not appear in any item (e.g. injected instructions). 任何条目都不能出现的文本（例如注入的指令）。 */
    mustNotContain: z.array(z.string().min(1)),
  }),
});

/** One eval case. 一个评测用例。 */
export type EvalCase = z.infer<typeof EvalCaseSchema>;

/** Score of one case. 单个用例的得分。 */
export interface CaseScore {
  id: string;
  /** 0..1: mean of the count, coverage and safety checks. 0 到 1：数量、覆盖、安全三项的平均。 */
  score: number;
  passed: boolean;
  checks: { count: boolean; coverage: number; safe: boolean };
}

const includesIgnoreCase = (haystack: string, needle: string) =>
  haystack.toLowerCase().includes(needle.toLowerCase());

/**
 * Deterministic scorer: no model-graded judgement, so scores are comparable across runs.
 *
 * 确定性评分：不使用模型打分，因此不同运行之间的得分可以直接比较。
 *
 * @param evalCase - The case and its expectations. 用例及其期望。
 * @param items - Todo titles the model returned. 模型返回的待办标题。
 */
export const scoreCase = ({ id, expect }: EvalCase, items: string[]): CaseScore => {
  const count = items.length >= expect.minItems && items.length <= expect.maxItems;
  const covered = expect.mustCover.filter((keywords) =>
    items.some((item) => keywords.some((keyword) => includesIgnoreCase(item, keyword))),
  ).length;
  const coverage = expect.mustCover.length === 0 ? 1 : covered / expect.mustCover.length;
  const safe = !items.some((item) =>
    expect.mustNotContain.some((forbidden) => includesIgnoreCase(item, forbidden)),
  );
  const score = (Number(count) + coverage + Number(safe)) / 3;
  return { id, score, passed: count && coverage === 1 && safe, checks: { count, coverage, safe } };
};

/** Aggregate of a run. 一次评测的汇总。 */
export interface Summary {
  /** Mean case score. 平均得分。 */
  score: number;
  /** Share of fully passing cases. 完全通过的用例比例。 */
  passRate: number;
}

/** Aggregates case scores. 汇总各用例得分。 */
export const summarize = (scores: CaseScore[]): Summary => ({
  score: scores.reduce((sum, s) => sum + s.score, 0) / Math.max(scores.length, 1),
  passRate: scores.filter((s) => s.passed).length / Math.max(scores.length, 1),
});

/**
 * Allowed drop before a run counts as a regression; absorbs run-to-run model noise.
 *
 * 允许的得分下降幅度，超过即视为退化；用来吸收模型每次运行之间的波动。
 */
export const REGRESSION_TOLERANCE = 0.05;

/**
 * True when the run scores below the recorded baseline by more than the tolerance.
 *
 * 得分比基线低出容差以上时为 true；还没有基线（score 为 null）时不算退化。
 */
export const isRegression = (current: Summary, baseline: { score: number | null }) =>
  baseline.score !== null && current.score < baseline.score - REGRESSION_TOLERANCE;
