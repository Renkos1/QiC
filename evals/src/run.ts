/*
 * Runs the split-todos eval against the real model and compares with baseline.json.
 *   pnpm eval                      compare against the baseline; exit 1 on regression
 *   pnpm eval -- --update-baseline record the current run as the new baseline
 * Requires ANTHROPIC_API_KEY (and optionally AI_MODEL); without it the run is skipped.
 *
 * 用真实模型运行拆分待办评测，并与 baseline.json 对比；退化时以 1 退出。
 * 加 `--update-baseline` 会把本次结果记录为新基线。需要 ANTHROPIC_API_KEY，否则跳过。
 * 注意：每次运行都会产生真实的 API 调用费用。
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AiGenerationError, createLanguageModel, splitIntoTodos } from "@qic/ai";
import { createLogger } from "@qic/logger";
import { z } from "zod";
import { type CaseScore, EvalCaseSchema, isRegression, scoreCase, summarize } from "./scoring.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const datasetFile = path.join(root, "datasets/split-todos.jsonl");
const baselineFile = path.join(root, "baseline.json");
const resultsFile = path.join(root, "results/latest.json");

const BaselineSchema = z.object({
  operation: z.string(),
  score: z.number().nullable(),
  passRate: z.number().nullable(),
  model: z.string().nullable(),
  recordedAt: z.string().nullable(),
  note: z.string().optional(),
});

const out = (line: string) => process.stdout.write(`${line}\n`);
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

const apiKey = process.env.ANTHROPIC_API_KEY;
const modelId = process.env.AI_MODEL;
const model = createLanguageModel({ apiKey, modelId });
if (!model) {
  out("[eval] ANTHROPIC_API_KEY is not set; skipping split-todos eval.");
  process.exit(0);
}

const logger = createLogger({ service: "evals", level: "warn" });
const cases = (await readFile(datasetFile, "utf8"))
  .split("\n")
  .filter((line) => line.trim())
  .map((line) => EvalCaseSchema.parse(JSON.parse(line)));

const scores: (CaseScore & { output: string[]; error?: string })[] = [];
let resolvedModel = modelId ?? "default";
for (const evalCase of cases) {
  try {
    const result = await splitIntoTodos(model, evalCase.input, logger);
    resolvedModel = result.modelId;
    scores.push({ ...scoreCase(evalCase, result.output.todos), output: result.output.todos });
  } catch (error) {
    // A failed generation scores zero; it is a regression signal, not a crash.
    const reason = error instanceof AiGenerationError ? String(error.cause) : String(error);
    scores.push({ ...scoreCase(evalCase, []), score: 0, passed: false, output: [], error: reason });
  }
  const last = scores.at(-1);
  out(`[eval] ${last?.passed ? "PASS" : "FAIL"} ${evalCase.id} score=${last?.score.toFixed(2)}`);
}

const summary = summarize(scores);
const baseline = BaselineSchema.parse(JSON.parse(await readFile(baselineFile, "utf8")));
out(`[eval] model=${resolvedModel} score=${pct(summary.score)} passRate=${pct(summary.passRate)}`);

await mkdir(path.dirname(resultsFile), { recursive: true });
await writeFile(
  resultsFile,
  `${JSON.stringify({ model: resolvedModel, ...summary, cases: scores }, null, 2)}\n`,
);

if (process.argv.includes("--update-baseline")) {
  const next = {
    operation: "split-todos",
    score: summary.score,
    passRate: summary.passRate,
    model: resolvedModel,
    recordedAt: new Date().toISOString(),
  };
  await writeFile(baselineFile, `${JSON.stringify(next, null, 2)}\n`);
  out("[eval] baseline.json updated; commit it with the prompt or model change.");
} else if (baseline.score === null) {
  out("[eval] no baseline recorded yet; run with --update-baseline to create one.");
} else if (isRegression(summary, baseline)) {
  out(`[eval] REGRESSION: ${pct(summary.score)} < baseline ${pct(baseline.score)}`);
  process.exit(1);
} else {
  out(`[eval] OK vs baseline ${pct(baseline.score)} (${baseline.model})`);
}
