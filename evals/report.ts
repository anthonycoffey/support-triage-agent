import { METRICS, type MetricName } from "./graders.js";
import { JUDGE_METRICS } from "./judge.js";
import type { ErrorRow, ResultRow } from "./runner.js";
import { pct, wilson } from "./stats.js";

export interface RunMeta {
  label: string;
  client: string;
  model: string;
  effort: string;
  prompt_version: string;
  dataset: string;
  cases: number;
  reps: number;
  started_at: string;
}

export interface Rate {
  passes: number;
  n: number;
  rate: number;
  lo: number;
  hi: number;
}

export interface Summary {
  meta: RunMeta;
  attempts: number;
  errors: Record<string, number>;
  outcomes: Record<string, number>;
  answer_rate: Rate;
  /** Computed over decision rows only. Non-answers are reported above, not averaged in. */
  metrics: Record<MetricName, Rate>;
  judge: Record<string, Rate> | null;
  escalation: { precision: number; recall: number; tp: number; fp: number; fn: number };
  by_tag: Record<string, { n: number; category: number; escalation: number }>;
  majority_category_baseline: number;
  policy_violations: { case_id: string; rep: number; reasons: string[] }[];
  fallback_rows: number;
  cost_usd: number | null;
  judge_cost_usd: number | null;
  mean_model_latency_ms: number;
}

function rate(passes: number, n: number): Rate {
  return { passes, n, ...wilson(passes, n) };
}

export function summarize(meta: RunMeta, rows: ResultRow[], errors: ErrorRow[], expectedCategories: string[]): Summary {
  const decided = rows.filter((r) => r.outcome === "decision" && r.grades);

  const metrics = Object.fromEntries(
    METRICS.map((m) => {
      const applicable = decided.filter((r) => r.grades![m] !== null);
      return [m, rate(applicable.filter((r) => r.grades![m]).length, applicable.length)];
    }),
  ) as Record<MetricName, Rate>;

  const judged = decided.filter((r) => r.judge);
  const judge = judged.length
    ? Object.fromEntries(JUDGE_METRICS.map((m) => [m, rate(judged.filter((r) => r.judge![m]).length, judged.length)]))
    : null;

  // Escalation precision/recall: accuracy alone hides an always-escalate policy.
  let tp = 0, fp = 0, fn = 0;
  for (const r of decided) {
    const predicted = r.decision!.escalate;
    const correct = r.grades!.escalation;
    if (predicted && correct) tp++;
    else if (predicted && !correct) fp++;
    else if (!predicted && !correct) fn++;
  }

  const by_tag: Summary["by_tag"] = {};
  for (const r of decided) {
    const t = (by_tag[r.tags[0]!] ??= { n: 0, category: 0, escalation: 0 });
    t.n++;
    t.category += r.grades!.category ? 1 : 0;
    t.escalation += r.grades!.escalation ? 1 : 0;
  }
  for (const t of Object.values(by_tag)) {
    t.category /= t.n;
    t.escalation /= t.n;
  }

  const counts = new Map<string, number>();
  for (const c of expectedCategories) counts.set(c, (counts.get(c) ?? 0) + 1);
  const majority = Math.max(...counts.values()) / expectedCategories.length;

  const costs = rows.map((r) => r.cost_usd);
  const judgeCosts = judged.map((r) => r.judge!.cost_usd);

  return {
    meta,
    attempts: rows.length + errors.length,
    errors: tally(errors.map((e) => e.error_class)),
    outcomes: tally(rows.map((r) => r.outcome)),
    answer_rate: rate(decided.length, rows.length),
    metrics,
    judge,
    escalation: { precision: tp / (tp + fp || 1), recall: tp / (tp + fn || 1), tp, fp, fn },
    by_tag,
    majority_category_baseline: majority,
    policy_violations: rows
      .filter((r) => r.violations.length)
      .map((r) => ({ case_id: r.case_id, rep: r.rep, reasons: r.violations })),
    fallback_rows: rows.filter((r) => r.fallback_used).length,
    cost_usd: costs.includes(null) ? null : costs.reduce<number>((a, b) => a + (b ?? 0), 0),
    judge_cost_usd: judgeCosts.length && !judgeCosts.includes(null) ? judgeCosts.reduce<number>((a, b) => a + (b ?? 0), 0) : null,
    mean_model_latency_ms: rows.length ? Math.round(rows.reduce((a, r) => a + r.model_latency_ms, 0) / rows.length) : 0,
  };
}

function tally(xs: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of xs) out[x] = (out[x] ?? 0) + 1;
  return out;
}

const fmtRate = (r: Rate) => `${pct(r.rate)} (${r.passes}/${r.n}, 95% CI ${pct(r.lo)}–${pct(r.hi)})`;

export function renderMarkdown(s: Summary): string {
  const m = s.meta;
  const lines = [
    `# Eval report: ${m.label}`,
    "",
    `client \`${m.client}\` · model \`${m.model}\` · effort \`${m.effort}\` · prompt v${m.prompt_version} · ${m.cases} cases × ${m.reps} reps · ${m.started_at}`,
    "",
    "## Did it answer?",
    "",
    `- Attempts: ${s.attempts} (infra errors, excluded from scores: ${JSON.stringify(s.errors)})`,
    `- Outcomes: ${JSON.stringify(s.outcomes)}`,
    `- Answer rate: ${fmtRate(s.answer_rate)}`,
    s.fallback_rows ? `- ⚠ ${s.fallback_rows} rows were served by a fallback model; read them before trusting the headline.` : "",
    "",
    "## Quality (decision rows only)",
    "",
    "| Metric | Score |",
    "| --- | --- |",
    ...METRICS.map((k) => `| ${k} | ${fmtRate(s.metrics[k])} |`),
    "",
    `Category majority-class baseline: ${pct(s.majority_category_baseline)}. ` +
      `Escalation precision ${pct(s.escalation.precision)}, recall ${pct(s.escalation.recall)} (tp ${s.escalation.tp}, fp ${s.escalation.fp}, fn ${s.escalation.fn}).`,
    "",
  ];

  if (s.judge) {
    lines.push("## Reply quality (LLM judge, not yet calibrated: advisory only)", "", "| Criterion | Score |", "| --- | --- |");
    for (const [k, r] of Object.entries(s.judge)) lines.push(`| ${k} | ${fmtRate(r)} |`);
    lines.push("");
  }

  lines.push("## Policy violations (any violation fails the run)", "");
  if (s.policy_violations.length === 0) lines.push("None.");
  for (const v of s.policy_violations) lines.push(`- \`${v.case_id}\` rep ${v.rep}: ${v.reasons.join("; ")}`);

  lines.push("", "## By primary tag", "", "| Tag | n | category | escalation |", "| --- | --- | --- | --- |");
  for (const [tag, t] of Object.entries(s.by_tag).sort()) lines.push(`| ${tag} | ${t.n} | ${pct(t.category)} | ${pct(t.escalation)} |`);

  lines.push(
    "",
    "## Cost and latency",
    "",
    `- Agent cost: ${s.cost_usd === null ? "n/a (unpriced model)" : `$${s.cost_usd.toFixed(4)}`}`,
    `- Judge cost: ${s.judge_cost_usd === null ? "n/a" : `$${s.judge_cost_usd.toFixed(4)}`}`,
    `- Mean model latency per attempt: ${s.mean_model_latency_ms} ms`,
    "",
  );
  return lines.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
}
