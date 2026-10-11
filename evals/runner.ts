import Anthropic from "@anthropic-ai/sdk";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ModelClient } from "../src/agent/client.js";
import type { TriageDecision } from "../src/agent/schema.js";
import { type AgentConfig, type Outcome, triage } from "../src/agent/triage.js";
import type { EvalCase } from "./case.js";
import { type Grades, grade, policyViolations } from "./graders.js";
import { type JudgeVerdict, judgeReply } from "./judge.js";
import { costUsd } from "./stats.js";

/** One scorable attempt. Attempts that never produced output go to ErrorRow instead. */
export interface ResultRow {
  case_id: string;
  rep: number;
  tags: string[];
  outcome: Outcome;
  decision: TriageDecision | null;
  grades: Grades | null;
  violations: string[];
  served_models: string[];
  fallback_used: boolean;
  model_calls: number;
  tool_calls: string[];
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number };
  cost_usd: number | null;
  model_latency_ms: number;
  judge: (JudgeVerdict & { model: string; cost_usd: number | null }) | null;
}

export interface ErrorRow {
  case_id: string;
  rep: number;
  error_class: "timeout" | "api_error" | "harness";
  message: string;
}

export interface RunOptions {
  cases: EvalCase[];
  client: ModelClient;
  config: AgentConfig;
  reps: number;
  concurrency: number;
  /** Hard wall-clock ceiling per attempt, independent of stream liveness. */
  timeoutMs: number;
  outDir: string;
  judge?: Anthropic;
}

export async function runEval(opts: RunOptions): Promise<{ rows: ResultRow[]; errors: ErrorRow[] }> {
  mkdirSync(join(opts.outDir, "transcripts"), { recursive: true });
  const jobs = opts.cases.flatMap((c) => Array.from({ length: opts.reps }, (_, rep) => ({ c, rep })));
  const rows: ResultRow[] = [];
  const errors: ErrorRow[] = [];

  let cursor = 0;
  const worker = async () => {
    while (cursor < jobs.length) {
      const { c, rep } = jobs[cursor++]!;
      const result = await attempt(c, rep, opts);
      if ("error_class" in result) errors.push(result);
      else rows.push(result);
      process.stdout.write("error_class" in result ? "E" : result.outcome === "decision" ? "." : "x");
    }
  };
  await Promise.all(Array.from({ length: Math.min(opts.concurrency, jobs.length) }, worker));
  process.stdout.write("\n");

  const byKey = (a: { case_id: string; rep: number }, b: { case_id: string; rep: number }) =>
    a.case_id.localeCompare(b.case_id) || a.rep - b.rep;
  rows.sort(byKey);
  errors.sort(byKey);
  writeFileSync(join(opts.outDir, "results.jsonl"), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  writeFileSync(join(opts.outDir, "errors.jsonl"), errors.map((e) => JSON.stringify(e)).join("\n") + (errors.length ? "\n" : ""));
  return { rows, errors };
}

async function attempt(c: EvalCase, rep: number, opts: RunOptions): Promise<ResultRow | ErrorRow> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const r = await triage(c.ticket, opts.client, opts.config, controller.signal);
    writeFileSync(
      join(opts.outDir, "transcripts", `${c.id}__r${rep}.json`),
      JSON.stringify({ case: c, outcome: r.outcome, decision: r.decision, modelCalls: r.modelCalls, toolCalls: r.toolCalls, messages: r.messages }, null, 2),
    );

    const usage = r.modelCalls.reduce(
      (acc, m) => ({
        input: acc.input + m.usage.input,
        output: acc.output + m.usage.output,
        cacheRead: acc.cacheRead + m.usage.cacheRead,
        cacheWrite: acc.cacheWrite + m.usage.cacheWrite,
      }),
      { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    );
    const callCosts = r.modelCalls.map((m) => costUsd(m.servedModel, m.usage));
    const servedModels = [...new Set(r.modelCalls.map((m) => m.servedModel))];

    let judge: ResultRow["judge"] = null;
    if (opts.judge && r.decision) {
      const j = await judgeReply(opts.judge, c, r.decision, controller.signal);
      if (j.verdict) judge = { ...j.verdict, model: j.model, cost_usd: costUsd(j.model, j.usage) };
    }

    return {
      case_id: c.id,
      rep,
      tags: c.tags,
      outcome: r.outcome,
      decision: r.decision ?? null,
      grades: r.decision ? grade(c, r) : null,
      violations: r.decision ? policyViolations(c, r.decision.reply_draft) : [],
      served_models: servedModels,
      fallback_used: servedModels.some((m) => m !== opts.config.model),
      model_calls: r.modelCalls.length,
      tool_calls: r.toolCalls.map((t) => t.name),
      usage,
      cost_usd: callCosts.includes(null) ? null : callCosts.reduce<number>((a, b) => a + (b ?? 0), 0),
      model_latency_ms: r.modelCalls.reduce((a, m) => a + m.latencyMs, 0),
      judge,
    };
  } catch (err) {
    const error_class = controller.signal.aborted ? "timeout" : err instanceof Anthropic.APIError ? "api_error" : "harness";
    return { case_id: c.id, rep, error_class, message: (err as Error).message };
  } finally {
    clearTimeout(timer);
  }
}
