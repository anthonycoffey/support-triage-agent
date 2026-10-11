import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import type { ModelClient } from "../src/agent/client.js";
import { PROMPT_VERSION } from "../src/agent/prompt.js";
import type { AgentConfig } from "../src/agent/triage.js";
import type { EvalCase } from "./case.js";
import { type Summary, renderMarkdown, summarize } from "./report.js";
import { runEval } from "./runner.js";

export interface ExecuteOptions {
  label: string;
  dataset: string;
  cases: EvalCase[];
  client: ModelClient;
  config: AgentConfig;
  reps: number;
  concurrency: number;
  timeoutMs: number;
  judge?: Anthropic;
  runsDir?: string;
}

/** Run, summarize and write a complete run directory. Returns the summary and its path. */
export async function execute(o: ExecuteOptions): Promise<{ summary: Summary; outDir: string }> {
  const startedAt = new Date().toISOString();
  const outDir = join(o.runsDir ?? "evals/runs", `${startedAt.replace(/[:.]/g, "-")}_${o.label}`);
  mkdirSync(outDir, { recursive: true });

  const { rows, errors } = await runEval({
    cases: o.cases,
    client: o.client,
    config: o.config,
    reps: o.reps,
    concurrency: o.concurrency,
    timeoutMs: o.timeoutMs,
    outDir,
    judge: o.judge,
  });

  const summary = summarize(
    {
      label: o.label,
      client: o.client.name,
      model: o.config.model,
      effort: o.config.effort,
      prompt_version: PROMPT_VERSION,
      dataset: o.dataset,
      cases: o.cases.length,
      reps: o.reps,
      started_at: startedAt,
    },
    rows,
    errors,
    o.cases.map((c) => c.expected.category),
  );
  writeFileSync(join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
  writeFileSync(join(outDir, "report.md"), renderMarkdown(summary));
  return { summary, outDir };
}
